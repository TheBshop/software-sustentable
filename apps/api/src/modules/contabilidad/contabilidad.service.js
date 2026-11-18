// Contabilidad "para el contador": libros IVA y mayor simple, calculados al vuelo desde
// ventas, compras, gastos, ingresos de caja y liquidaciones. No reemplaza la contabilidad formal.
//
// Supuestos de IVA (el sistema no guarda el desglose fiscal de cada operación):
//  - Los importes registrados incluyen IVA 21 % (neto = total / 1,21), salvo que la contraparte sea
//    exenta (todo va a la columna "exento").
//  - Sin CUIT, o condición "consumidor final": Consumidor Final, mismo criterio (total con IVA 21 %).
//  - En compras solo se computa crédito fiscal si el proveedor es Responsable Inscripto con CUIT;
//    recuperadores, monotributistas, exentos y gastos sin CUIT van sin IVA (neto = total).
//  - No se registran percepciones ni alícuota 10,5 %: las columnas existen y quedan en 0.
import { Sale } from '../plant/plant.models.js';
import { Invoice } from '../invoices/invoice.model.js';
import { Compra } from '../recuperadores/recuperadores.js';
import { Gasto } from '../finanzas/gasto.model.js';
import { IngresoCaja } from '../comercial/comercial.models.js';
import { round2 } from '../../lib/validation.js';

export const CUENTAS = ['caja', 'ventas', 'gastos', 'clientes'];
export const CONDICION_LABEL = {
  responsable_inscripto: 'Responsable Inscripto',
  monotributo: 'Monotributo',
  exento: 'Exento',
  consumidor_final: 'Consumidor Final',
};
const CF = 'Consumidor Final';
const ALICUOTA = 1.21;

const sum = (arr, f) => round2(arr.reduce((a, x) => a + (f(x) ?? 0), 0));
const enRango = (f, desde, hasta) => f >= desde && f <= hasta;
export const formatCuit = (c) => (c && /^\d{11}$/.test(c) ? `${c.slice(0, 2)}-${c.slice(2, 10)}-${c.slice(10)}` : (c ?? ''));

/** Datos fiscales de un cliente: sin CUIT (o consumidor final) → Consumidor Final. */
export function datosFiscales(c) {
  const cuit = c?.cuit ?? '';
  const cond = c?.condicionIva;
  if (!cuit || cond === 'consumidor_final') return { cuit, condicion: 'consumidor_final', condicionIva: CF };
  return { cuit, condicion: cond, condicionIva: CONDICION_LABEL[cond] ?? CONDICION_LABEL.responsable_inscripto };
}

/** Separa un total con IVA incluido. */
export function desglosarVenta(total, condicion) {
  total = round2(total ?? 0);
  if (condicion === 'exento') return { neto: 0, iva21: 0, iva105: 0, exento: total, percepciones: 0, total };
  const neto = round2(total / ALICUOTA);
  return { neto, iva21: round2(total - neto), iva105: 0, exento: 0, percepciones: 0, total };
}

export function desglosarCompra(total, aplicaIva) {
  total = round2(total ?? 0);
  if (!aplicaIva) return { neto: total, iva21: 0, otrosImpuestos: 0, total };
  const neto = round2(total / ALICUOTA);
  return { neto, iva21: round2(total - neto), otrosImpuestos: 0, total };
}

const porFecha = (a, b) => a.fecha - b.fecha;

export async function libroVentas(desde, hasta) {
  const [ventas, facturas] = await Promise.all([
    Sale.find({ fecha: { $gte: desde, $lte: hasta } }).populate('comprador', 'razonSocial cuit condicionIva').lean(),
    Invoice.find({ estado: { $ne: 'anulada' }, emitidaEn: { $gte: desde, $lte: hasta } }).populate('cliente', 'razonSocial cuit condicionIva').lean(),
  ]);
  const filas = [
    ...ventas.map((v) => {
      const f = datosFiscales(v.comprador);
      return { fecha: v.fecha, comprobante: v.remito ? `Remito ${v.remito}` : `Venta ${String(v._id).slice(-6)}`, origen: 'venta', cliente: v.comprador?.razonSocial ?? '—', cuit: formatCuit(f.cuit), condicionIva: f.condicionIva, ...desglosarVenta(v.total, f.condicion) };
    }),
    ...facturas.map((i) => {
      const snap = i.clienteSnapshot?.razonSocial ? i.clienteSnapshot : i.cliente;
      const f = datosFiscales(snap);
      const cf = i.comprobanteFiscal;
      const comprobante = cf?.numero ? `${String(cf.puntoVenta ?? 0).padStart(4, '0')}-${String(cf.numero).padStart(8, '0')}` : `Liquidación ${i.numero}`;
      return { fecha: i.emitidaEn, comprobante, origen: 'factura', cliente: snap?.razonSocial ?? '—', cuit: formatCuit(f.cuit), condicionIva: f.condicionIva, ...desglosarVenta(i.total, f.condicion) };
    }),
  ].sort(porFecha);
  const totales = Object.fromEntries(['neto', 'iva21', 'iva105', 'exento', 'percepciones', 'total'].map((k) => [k, sum(filas, (r) => r[k])]));
  return { periodo: { desde, hasta }, filas, totales };
}

export async function libroCompras(desde, hasta) {
  const [compras, gastos] = await Promise.all([
    Compra.find({ fecha: { $gte: desde, $lte: hasta } }).populate('recuperador', 'nombre documento').populate('proveedor', 'razonSocial cuit condicionIva').lean(),
    // Los retiros de socios no son una compra: no van al libro
    Gasto.find({ fecha: { $gte: desde, $lte: hasta }, categoria: { $ne: 'retiros_socios' } }).lean(),
  ]);
  const filas = [
    ...compras.map((c) => {
      const p = c.proveedor;
      const aplica = Boolean(p?.cuit) && (p.condicionIva ?? 'responsable_inscripto') === 'responsable_inscripto';
      return {
        fecha: c.fecha,
        comprobante: `Compra ${c.numero ?? ''}`.trim(),
        origen: 'compra',
        proveedor: p?.razonSocial ?? c.recuperador?.nombre ?? '—',
        cuit: p ? formatCuit(p.cuit) : (c.recuperador?.documento ?? ''),
        condicionIva: p ? (p.cuit ? (CONDICION_LABEL[p.condicionIva] ?? CONDICION_LABEL.responsable_inscripto) : CF) : 'Recuperador urbano',
        ...desglosarCompra(c.total, aplica),
      };
    }),
    ...gastos.map((g) => ({
      fecha: g.fecha,
      comprobante: g.comprobante || 'Sin comprobante',
      origen: 'gasto',
      proveedor: g.proveedor || g.descripcion,
      cuit: '',
      condicionIva: '—',
      // Impuestos y tasas: no son neto gravado, van a "otros impuestos"
      ...(g.categoria === 'impuestos' ? { neto: 0, iva21: 0, otrosImpuestos: round2(g.monto), total: round2(g.monto) } : desglosarCompra(g.monto, false)),
    })),
  ].sort(porFecha);
  const totales = Object.fromEntries(['neto', 'iva21', 'otrosImpuestos', 'total'].map((k) => [k, sum(filas, (r) => r[k])]));
  return { periodo: { desde, hasta }, filas, totales };
}

/** Todos los movimientos de la cuenta hasta `hasta` (sin límite inferior, para el saldo inicial). */
async function movimientos(cuenta, hasta) {
  const hastaQ = { $lte: hasta };
  const mov = (fecha, concepto, debe, haber) => ({ fecha, concepto, debe: round2(debe), haber: round2(haber) });
  const cobros = (invoices) => invoices.flatMap((i) => i.pagos.filter((p) => p.fecha <= hasta).map((p) => ({ i, p })));
  let m = [];
  if (cuenta === 'caja') {
    const [ingresos, invoices, gastos, compras] = await Promise.all([
      IngresoCaja.find({ fecha: hastaQ }).lean(),
      Invoice.find({ estado: { $ne: 'anulada' } }).lean(),
      Gasto.find({ fecha: hastaQ }).lean(),
      Compra.find({ pagada: true, fechaPago: hastaQ }).populate('recuperador', 'nombre').populate('proveedor', 'razonSocial').lean(),
    ]);
    m = [
      ...ingresos.map((i) => mov(i.fecha, `Ingreso: ${i.concepto}${i.detalle ? ` · ${i.detalle}` : ''}`, 0, i.monto)),
      ...cobros(invoices).map(({ i, p }) => mov(p.fecha, `Cobro liquidación ${i.numero}${p.medio ? ` (${p.medio})` : ''}`, 0, p.monto)),
      ...gastos.map((g) => mov(g.fecha, `Gasto: ${g.descripcion}`, g.monto, 0)),
      ...compras.map((c) => mov(c.fechaPago, `Pago compra ${c.numero} · ${c.proveedor?.razonSocial ?? c.recuperador?.nombre ?? '—'}`, c.total, 0)),
    ];
  } else if (cuenta === 'ventas') {
    const [ventas, invoices] = await Promise.all([
      Sale.find({ fecha: hastaQ }).populate('comprador', 'razonSocial').lean(),
      Invoice.find({ estado: { $ne: 'anulada' }, emitidaEn: hastaQ }).lean(),
    ]);
    m = [
      ...ventas.map((v) => mov(v.fecha, `Venta de material · ${v.comprador?.razonSocial ?? '—'}${v.remito ? ` (remito ${v.remito})` : ''}`, 0, v.total)),
      ...invoices.map((i) => mov(i.emitidaEn, `Liquidación ${i.numero} · ${i.clienteSnapshot?.razonSocial ?? '—'}`, 0, i.total)),
    ];
  } else if (cuenta === 'gastos') {
    const [gastos, compras] = await Promise.all([
      Gasto.find({ fecha: hastaQ }).lean(),
      Compra.find({ fecha: hastaQ }).populate('recuperador', 'nombre').populate('proveedor', 'razonSocial').lean(),
    ]);
    m = [
      ...gastos.map((g) => mov(g.fecha, `${g.descripcion}${g.proveedor ? ` · ${g.proveedor}` : ''}`, g.monto, 0)),
      ...compras.map((c) => mov(c.fecha, `Compra de material ${c.numero} · ${c.proveedor?.razonSocial ?? c.recuperador?.nombre ?? '—'}`, c.total, 0)),
    ];
  } else {
    const invoices = await Invoice.find({ estado: { $ne: 'anulada' } }).lean();
    m = [
      ...invoices.filter((i) => i.emitidaEn <= hasta).map((i) => mov(i.emitidaEn, `Liquidación ${i.numero} · ${i.clienteSnapshot?.razonSocial ?? '—'}`, i.total, 0)),
      ...cobros(invoices).map(({ i, p }) => mov(p.fecha, `Cobro liquidación ${i.numero} · ${i.clienteSnapshot?.razonSocial ?? '—'}`, 0, p.monto)),
    ];
  }
  return m.sort(porFecha);
}

/** Cuentas que en este mayor simple se leen como haber − debe (caja y ventas). */
const ACREEDORAS = new Set(['caja', 'ventas']);

export async function mayor(cuenta, desde, hasta) {
  const todos = await movimientos(cuenta, hasta);
  const signo = ACREEDORAS.has(cuenta) ? -1 : 1; // saldo = signo · (debe − haber)
  const delta = (x) => signo * (x.debe - x.haber);
  const saldoInicial = round2(todos.filter((x) => x.fecha < desde).reduce((a, x) => a + delta(x), 0));
  let saldo = saldoInicial;
  const filas = todos.filter((x) => enRango(x.fecha, desde, hasta)).map((x) => ({ ...x, saldo: (saldo = round2(saldo + delta(x))) }));
  return {
    cuenta,
    periodo: { desde, hasta },
    saldoInicial,
    filas,
    totales: { debe: sum(filas, (r) => r.debe), haber: sum(filas, (r) => r.haber), saldo },
  };
}
