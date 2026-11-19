import { Presupuesto } from './presupuesto.model.js';
import { Invoice } from '../invoices/invoice.model.js';
import { Client } from '../clients/client.model.js';
import { nextSeq } from '../../lib/counters.js';
import { HttpError } from '../../middleware/error.js';

const round2 = (n) => Math.round(n * 100) / 100;

/** Crea un presupuesto nuevo con numero correlativo. */
export async function crearPresupuesto({ cliente: clienteId, lineas, vigenciaHasta, notas }) {
  const cliente = await Client.findById(clienteId);
  if (!cliente) throw new HttpError(404, 'Cliente no encontrado');
  if (!Array.isArray(lineas) || !lineas.length) throw new HttpError(422, 'El presupuesto necesita al menos una línea');
  const lineasCalc = lineas.map((l) => ({ ...l, subtotal: round2((l.cantidad ?? 1) * (l.precioUnitario ?? 0)) }));
  const total = round2(lineasCalc.reduce((a, l) => a + l.subtotal, 0));
  const numero = await nextSeq('presupuesto');
  return Presupuesto.create({
    numero,
    cliente: cliente._id,
    clienteSnapshot: { razonSocial: cliente.razonSocial, cuit: cliente.cuit, condicionIva: cliente.condicionIva },
    lineas: lineasCalc,
    total,
    vigenciaHasta,
    notas,
  });
}

/** Convierte un presupuesto aceptado en una factura (prefactura interna). */
export async function convertirEnFactura(id, { vencimiento } = {}) {
  const p = await Presupuesto.findById(id);
  if (!p) throw new HttpError(404, 'Presupuesto no encontrado');
  if (p.estado === 'convertido' && p.facturaGenerada) throw new HttpError(409, 'Ya se convirtió en factura');
  if (p.estado === 'rechazado') throw new HttpError(409, 'El presupuesto fue rechazado');
  const cliente = await Client.findById(p.cliente);
  if (!cliente) throw new HttpError(409, 'Cliente eliminado');
  const numero = await nextSeq('factura');
  const venc = vencimiento ? new Date(vencimiento) : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
  const factura = await Invoice.create({
    numero,
    cliente: cliente._id,
    clienteSnapshot: p.clienteSnapshot,
    lineas: p.lineas,
    total: p.total,
    vencimiento: venc,
    estado: 'pendiente',
  });
  p.estado = 'convertido';
  p.facturaGenerada = factura._id;
  await p.save();
  return { presupuesto: p, factura };
}

/** Cambia estado. Si vence por tiempo, se marca al leer. */
export async function cambiarEstado(id, estado) {
  const p = await Presupuesto.findById(id);
  if (!p) throw new HttpError(404, 'Presupuesto no encontrado');
  if (p.estado === 'convertido') throw new HttpError(409, 'Ya se convirtió en factura');
  p.estado = estado;
  await p.save();
  return p;
}
