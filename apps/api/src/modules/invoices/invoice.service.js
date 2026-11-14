import { Invoice } from './invoice.model.js';
import { Client } from '../clients/client.model.js';
import { Pickup, pesoEfectivo } from '../pickups/pickup.model.js';
import { nextSeq } from '../../lib/counters.js';
import { round2, endOfLocalDay } from '../../lib/validation.js';
import { HttpError } from '../../middleware/error.js';

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Calcula (sin guardar) la factura de un cliente para un período, a partir de los retiros
 * no anulados y todavía no facturados. Las reglas dependen de la modalidad de tarifa:
 *  - por_retiro:    cantidad de retiros × montoFijo
 *  - por_kg:        kg por material × precio del cliente (o tarifa por defecto del material)
 *  - abono_mensual: montoFijo (los retiros quedan asociados igual, para trazabilidad)
 *  - sin_cargo:     no se factura
 */
export async function buildInvoiceDraft({ cliente: clienteId, desde, hasta }) {
  const cliente = await Client.findById(clienteId);
  if (!cliente) throw new HttpError(404, 'Cliente no encontrado');
  const { modalidad, montoFijo = 0, preciosPorKg = [] } = cliente.tarifa ?? {};
  if (!modalidad || modalidad === 'sin_cargo') throw new HttpError(422, 'El cliente no tiene una tarifa facturable');

  const hastaFinDelDia = endOfLocalDay(hasta); // "hasta 2026-11-30" incluye todo ese día
  const retiros = await Pickup.find({
    cliente: cliente._id,
    fecha: { $gte: desde, $lte: hastaFinDelDia },
    estado: { $ne: 'anulado' },
    factura: null,
  }).populate('items.material');

  let lineas = [];
  if (modalidad === 'por_retiro') {
    if (retiros.length) {
      lineas.push({ descripcion: 'Servicio de retiro de materiales reciclables', cantidad: retiros.length, unidad: 'retiro', precioUnitario: montoFijo });
    }
  } else if (modalidad === 'por_kg') {
    const porMaterial = new Map();
    for (const r of retiros) {
      for (const it of r.items) {
        const key = String(it.material._id);
        const acc = porMaterial.get(key) ?? { material: it.material, kg: 0 };
        acc.kg += pesoEfectivo(it);
        porMaterial.set(key, acc);
      }
    }
    for (const [key, { material, kg }] of porMaterial) {
      const override = preciosPorKg.find((p) => String(p.material) === key);
      const precio = override?.precio ?? material.tarifaRetiroKg ?? 0;
      if (precio > 0) lineas.push({ descripcion: `Retiro y gestión de ${material.nombre}`, cantidad: round2(kg), unidad: 'kg', precioUnitario: precio });
    }
  } else if (modalidad === 'abono_mensual') {
    lineas.push({ descripcion: 'Abono mensual servicio de retiro', cantidad: 1, unidad: 'mes', precioUnitario: montoFijo });
  }

  lineas = lineas.map((l) => ({ ...l, subtotal: round2(l.cantidad * l.precioUnitario) }));
  const total = round2(lineas.reduce((a, l) => a + l.subtotal, 0));

  // Detalle retiro por retiro, para que el cliente pueda auditar el cálculo.
  const detalle = retiros.map((r) => ({
    retiro: r._id,
    numero: r.numero,
    fecha: r.fecha,
    sede: r.direccion,
    kg: round2(r.items.reduce((a, it) => a + pesoEfectivo(it), 0)),
    importe: importeDeRetiro(r, cliente),
  }));
  return { cliente, retiros, lineas, total, detalle };
}

export async function createInvoice({ cliente, desde, hasta, vencimiento }) {
  const draft = await buildInvoiceDraft({ cliente, desde, hasta });
  if (!draft.lineas.length || draft.total <= 0) throw new HttpError(422, 'No hay importes a facturar en el período');

  const dias = draft.cliente.contrato?.diasPagoFactura ?? 15;
  const invoice = await Invoice.create({
    numero: await nextSeq('factura'),
    cliente: draft.cliente._id,
    clienteSnapshot: { razonSocial: draft.cliente.razonSocial, cuit: draft.cliente.cuit, condicionIva: draft.cliente.condicionIva },
    periodo: { desde, hasta },
    retiros: draft.retiros.map((r) => r._id),
    lineas: draft.lineas,
    detalle: draft.detalle,
    total: draft.total,
    vencimiento: vencimiento ?? new Date(Date.now() + dias * DIA_MS),
  });

  // Marca los retiros como facturados (solo los que siguen libres, por si hubo concurrencia).
  await Pickup.updateMany({ _id: { $in: invoice.retiros }, factura: null }, { factura: invoice._id });
  return invoice;
}

export async function registerPayment(invoiceId, { monto, fecha, medio, referencia }) {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw new HttpError(404, 'Factura no encontrada');
  if (invoice.estado !== 'pendiente') throw new HttpError(409, `La factura está ${invoice.estado}`);
  invoice.pagos.push({ monto, fecha, medio, referencia });
  if (invoice.saldo <= 0) invoice.estado = 'pagada';
  await invoice.save();
  return invoice;
}

export async function cancelInvoice(invoiceId) {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw new HttpError(404, 'Factura no encontrada');
  if (invoice.pagos.length) throw new HttpError(409, 'No se puede anular una factura con pagos registrados');
  invoice.estado = 'anulada';
  await invoice.save();
  // Libera los retiros para que puedan volver a facturarse.
  await Pickup.updateMany({ factura: invoice._id }, { factura: null });
  return invoice;
}

/** Alertas de cobranza: vencidas y que vencen en los próximos `dias` días. */
export async function paymentAlerts(dias = 7) {
  const ahora = new Date();
  const limite = new Date(ahora.getTime() + dias * DIA_MS);
  const pendientes = await Invoice.find({ estado: 'pendiente', vencimiento: { $lte: limite } })
    .sort('vencimiento')
    .populate('cliente', 'razonSocial contacto');

  const toAlert = (inv) => ({
    id: inv._id,
    numero: inv.numero,
    cliente: inv.cliente,
    vencimiento: inv.vencimiento,
    saldo: inv.saldo,
    diasRestantes: Math.ceil((inv.vencimiento - ahora) / DIA_MS),
  });
  const vencidas = pendientes.filter((i) => i.vencimiento < ahora).map(toAlert);
  const porVencer = pendientes.filter((i) => i.vencimiento >= ahora).map(toAlert);
  return {
    vencidas,
    porVencer,
    totalVencido: round2(vencidas.reduce((a, i) => a + i.saldo, 0)),
    totalPorVencer: round2(porVencer.reduce((a, i) => a + i.saldo, 0)),
  };
}

/**
 * Lo que se le cobra a un cliente por un retiro según su tarifa (items con material populado).
 * null = no se cobra por retiro (abono mensual o sin cargo).
 */
export function importeDeRetiro(retiro, cliente) {
  const { modalidad, montoFijo = 0, preciosPorKg = [] } = cliente?.tarifa ?? {};
  if (modalidad === 'por_retiro') return montoFijo;
  if (modalidad !== 'por_kg') return null;
  const precioKg = (material) => preciosPorKg.find((p) => String(p.material) === String(material._id ?? material))?.precio ?? material.tarifaRetiroKg ?? 0;
  return round2(retiro.items.reduce((a, it) => a + pesoEfectivo(it) * precioKg(it.material), 0));
}
