// Comercial: stock y margen, padrón de clientes y proveedores, contratos de venta,
// convenio con el municipio e ingresos de caja.
import { Router } from 'express';
import { z } from 'zod';
import { TIPOS_OBL } from '@nueva-vida/catalogos';
import { Contrato, Convenio, IngresoCaja, CONCEPTOS_INGRESO } from './comercial.models.js';
import { Sale } from '../plant/plant.models.js';
import { Compra } from '../recuperadores/recuperadores.js';
import { Client } from '../clients/client.model.js';
import { Material } from '../materials/material.model.js';
import { Movimiento } from '../movimientos/movimiento.model.js';
import { stock } from '../movimientos/movimiento.service.js';
import { crudRouter } from '../../lib/crud.js';
import { cuitValido } from '../../lib/cuit.js';
import { objectId, dateInput, endOfLocalDay, parseLocalDate, startOfLocalMonth, round2 } from '../../lib/validation.js';
import { requireRole } from '../../middleware/auth.js';
import { HttpError } from '../../middleware/error.js';

const DIA = 86400000;
const div = (a, b) => (b ? a / b : null);
const mesActual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const rangoMes = (mes) => {
  const desde = parseLocalDate(`${mes}-01`);
  const hasta = new Date(desde);
  hasta.setMonth(hasta.getMonth() + 1);
  return { $gte: desde, $lt: hasta };
};
const mesesHasta = (mes, n) => {
  const [y, m] = mes.split('-').map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(y, m - 1 - (n - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
};

// ---------- Stock y margen ----------
export const comercialRouter = Router();

/**
 * Por material: stock del libro de planta, comprado y costo promedio de compra, vendido y precio
 * promedio de venta, margen por kg y valor del stock (al último precio de venta, o al de lista).
 */
comercialRouter.get('/stock', async (_req, res) => {
  const desdeMes = startOfLocalMonth(new Date());
  const [st, ventas, compras, ultimas, mats, ventasMes] = await Promise.all([
    stock(),
    Sale.aggregate([{ $unwind: '$items' }, { $group: { _id: '$items.material', kg: { $sum: '$items.pesoKg' }, monto: { $sum: { $multiply: ['$items.pesoKg', '$items.precioKg'] } } } }]),
    Compra.aggregate([{ $unwind: '$items' }, { $group: { _id: '$items.material', kg: { $sum: '$items.pesoKg' }, monto: { $sum: { $multiply: ['$items.pesoKg', '$items.precioKg'] } } } }]),
    Sale.aggregate([{ $sort: { fecha: -1 } }, { $unwind: '$items' }, { $group: { _id: '$items.material', precio: { $first: '$items.precioKg' } } }]),
    Material.find().select('nombre precioVentaKg mezcla').lean(),
    Sale.aggregate([{ $match: { fecha: { $gte: desdeMes } } }, { $unwind: '$items' }, { $group: { _id: '$items.material', kg: { $sum: '$items.pesoKg' }, monto: { $sum: { $multiply: ['$items.pesoKg', '$items.precioKg'] } } } }]),
  ]);
  const por = (arr) => new Map(arr.map((x) => [String(x._id ?? x.materialId), x]));
  const [S, V, C, U, VM] = [por(st), por(ventas), por(compras), por(ultimas), por(ventasMes)];
  const filas = mats
    .filter((m) => !m.mezcla && (S.has(String(m._id)) || V.has(String(m._id)) || C.has(String(m._id))))
    .map((m) => {
      const id = String(m._id);
      const v = V.get(id);
      const c = C.get(id);
      const vm = VM.get(id);
      const kgStock = round2(S.get(id)?.kg ?? 0);
      const pv = div(v?.monto ?? 0, v?.kg ?? 0);
      const pc = div(c?.monto ?? 0, c?.kg ?? 0);
      const precioValor = U.get(id)?.precio ?? m.precioVentaKg ?? null;
      return {
        materialId: m._id,
        material: m.nombre,
        stockKg: kgStock,
        compradoKg: round2(c?.kg ?? 0),
        vendidoKg: round2(v?.kg ?? 0),
        precioVentaProm: pv == null ? null : round2(pv),
        costoCompraProm: pc == null ? null : round2(pc),
        margenKg: pv != null && pc != null ? round2(pv - pc) : null,
        valorStock: precioValor != null ? round2(Math.max(kgStock, 0) * precioValor) : null,
        ventasMes: round2(vm?.monto ?? 0),
        // Margen bruto del mes: lo vendido en el mes a precio de venta menos su costo promedio de compra
        margenMes: vm && pc != null ? round2(vm.monto - vm.kg * pc) : null,
      };
    })
    .sort((a, b) => b.stockKg - a.stockKg);
  const sum = (k) => round2(filas.reduce((a, f) => a + (f[k] ?? 0), 0));
  res.json({
    resumen: { stockKg: round2(filas.reduce((a, f) => a + Math.max(f.stockKg, 0), 0)), valorStock: sum('valorStock'), ventasMes: sum('ventasMes'), margenMes: filas.some((f) => f.margenMes != null) ? sum('margenMes') : null },
    negativos: filas.filter((f) => f.stockKg < 0).map((f) => f.material),
    items: filas,
  });
});

// ---------- Padrón de clientes y proveedores ----------
/** Clientes y proveedores con lo que se les compró y vendió, y el control del CUIT. */
comercialRouter.get('/padron', async (_req, res) => {
  const [clientes, ventas, compras] = await Promise.all([
    Client.find({ activo: true }).sort('razonSocial').lean(),
    Sale.aggregate([{ $unwind: '$items' }, { $group: { _id: '$comprador', kg: { $sum: '$items.pesoKg' }, monto: { $sum: { $multiply: ['$items.pesoKg', '$items.precioKg'] } } } }]),
    Compra.aggregate([{ $match: { proveedor: { $exists: true } } }, { $unwind: '$items' }, { $group: { _id: '$proveedor', kg: { $sum: '$items.pesoKg' }, monto: { $sum: { $multiply: ['$items.pesoKg', '$items.precioKg'] } } } }]),
  ]);
  const V = new Map(ventas.map((x) => [String(x._id), x]));
  const C = new Map(compras.map((x) => [String(x._id), x]));
  res.json({
    items: clientes.map((c) => ({
      _id: c._id,
      razonSocial: c.razonSocial,
      tipo: c.tipo,
      rubro: c.rubro,
      cuit: c.cuit,
      cuitEstado: !c.cuit ? 'falta' : cuitValido(c.cuit) ? 'valido' : 'invalido',
      vendido: V.has(String(c._id)) ? { kg: round2(V.get(String(c._id)).kg), monto: round2(V.get(String(c._id)).monto) } : null,
      comprado: C.has(String(c._id)) ? { kg: round2(C.get(String(c._id)).kg), monto: round2(C.get(String(c._id)).monto) } : null,
    })),
  });
});

// ---------- Contratos de venta ----------
/** Avance de un contrato con las ventas a ese comprador, de ese material, dentro del plazo. */
export async function avanceContrato(c, hoy = new Date()) {
  const ventas = await Sale.find({ comprador: c.comprador._id ?? c.comprador, fecha: { $gte: c.desde, $lte: endOfLocalDay(c.hasta) }, 'items.material': c.material._id ?? c.material }).lean();
  const items = ventas.flatMap((v) => v.items.filter((i) => String(i.material) === String(c.material._id ?? c.material)));
  const entregado = round2(items.reduce((a, i) => a + i.pesoKg, 0));
  const monto = items.reduce((a, i) => a + i.pesoKg * i.precioKg, 0);
  const desde = new Date(c.desde).getTime();
  const hasta = endOfLocalDay(c.hasta).getTime();
  const ahora = hoy.getTime();
  const restantes = ahora > hasta ? 0 : Math.ceil((hasta - Math.max(ahora, desde)) / DIA);
  const pasados = Math.max(1, Math.ceil((Math.min(ahora, hasta) - desde) / DIA));
  const pendiente = round2(Math.max(0, c.kg - entregado));
  const ritmo = ahora < desde ? 0 : entregado / pasados;
  const estado = entregado >= c.kg ? 'cumplido' : ahora > hasta ? 'vencido' : ahora < desde ? 'no_empezo' : ritmo * restantes < pendiente ? 'atrasado' : 'en_curso';
  return {
    entregado,
    pendiente,
    pct: c.kg ? round2(Math.min(1, entregado / c.kg) * 100) : 0,
    restantes,
    ritmoDiario: round2(ritmo),
    necesarioDiario: restantes && pendiente ? round2(pendiente / restantes) : null,
    precioProm: entregado ? round2(monto / entregado) : null,
    ventasBajoPrecio: items.filter((i) => i.precioKg < c.precioKg).length,
    estado,
  };
}

export const ESTADOS_CONTRATO = { cumplido: 'Cumplido', vencido: 'Vencido sin completar', no_empezo: 'Todavía no empezó', atrasado: 'Al ritmo actual no llegás', en_curso: 'En curso' };

const contratoInput = z
  .object({ comprador: objectId, material: objectId, kg: z.number().positive(), precioKg: z.number().min(0), desde: dateInput, hasta: dateInput, numero: z.string().max(40).optional(), notas: z.string().max(500).optional() })
  .refine((d) => d.hasta >= d.desde, { message: 'La fecha de fin es anterior a la de inicio', path: ['hasta'] });

export const contratosRouter = Router();
contratosRouter.get('/', async (_req, res) => {
  const lista = await Contrato.find({ activo: true }).sort('-hasta').populate('comprador', 'razonSocial').populate('material', 'nombre').lean();
  res.json({ estados: ESTADOS_CONTRATO, items: await Promise.all(lista.map(async (c) => ({ ...c, avance: await avanceContrato(c) }))) });
});
contratosRouter.post('/', requireRole('administracion'), async (req, res) => {
  const d = contratoInput.parse(req.body);
  if (!(await Client.exists({ _id: d.comprador }))) throw new HttpError(422, 'Comprador inexistente');
  if (!(await Material.exists({ _id: d.material }))) throw new HttpError(422, 'Material inexistente');
  res.status(201).json(await Contrato.create(d));
});
contratosRouter.delete('/:id', requireRole('administracion'), async (req, res) => {
  const c = await Contrato.findByIdAndUpdate(req.params.id, { activo: false });
  if (!c) throw new HttpError(404, 'Contrato no encontrado');
  res.status(204).end();
});

// ---------- Convenio con el municipio ----------
/**
 * Toneladas que entraron por recolección municipal en el mes (obligaciones automáticas).
 * Un mes sin ningún ingreso registrado es "sin dato" (null), no un incumplimiento: puede ser
 * anterior al uso del sistema.
 */
async function toneladasMunicipales(mes) {
  const r = await Movimiento.aggregate([
    { $match: { tipo: 'ingreso', fecha: rangoMes(mes) } },
    { $group: { _id: null, total: { $sum: 1 }, kg: { $sum: { $cond: [{ $eq: ['$origen.tipo', 'recoleccion_municipal'] }, '$kg', 0] } } } },
  ]);
  return r[0]?.total ? round2(r[0].kg / 1000) : null;
}

export function estadoObligacion(o, v) {
  if (v == null || v === '') return 'sin_dato';
  if (o.tipo === 'servicio') return v === 1 ? 'cumple' : 'no_cumple';
  if (o.meta == null || v >= o.meta) return 'cumple';
  return v > 0 ? 'parcial' : 'no_cumple';
}
export const ESTADOS_OBL = { cumple: 'Cumple', parcial: 'Parcial', no_cumple: 'No cumple', sin_dato: 'Sin dato' };

async function conEstados(cv, mes) {
  const meses = mesesHasta(mes, 6);
  const auto = cv.obligaciones.some((o) => o.auto) ? Object.fromEntries(await Promise.all(meses.map(async (m) => [m, await toneladasMunicipales(m)]))) : {};
  const valor = (o, m) => (o.auto ? auto[m] : cv.meses?.[m]?.[o.id]?.v);
  return {
    ...cv,
    mes,
    obligaciones: cv.obligaciones.map((o) => ({
      ...o,
      valor: valor(o, mes) ?? null,
      nota: cv.meses?.[mes]?.[o.id]?.nota ?? '',
      estado: estadoObligacion(o, valor(o, mes)),
      historial: meses.map((m) => ({ mes: m, estado: estadoObligacion(o, valor(o, m)) })),
    })),
  };
}

/** Texto con los incumplimientos del municipio en los últimos 12 meses, para presentar. */
async function resumenIncumplimientos(cv, mes) {
  const meses = mesesHasta(mes, 12);
  const lineas = [];
  for (const o of cv.obligaciones.filter((x) => x.parte === 'Municipio')) {
    for (const m of meses) {
      const v = o.auto ? await toneladasMunicipales(m) : cv.meses?.[m]?.[o.id]?.v;
      const e = estadoObligacion(o, v);
      if (e === 'no_cumple' || e === 'parcial') {
        const nota = cv.meses?.[m]?.[o.id]?.nota;
        lineas.push(`- ${m}: ${o.que}. ${o.tipo === 'servicio' ? 'No se cumplió' : `Pactado ${o.meta}${o.unidad ? ` ${o.unidad}` : ''}, cumplido ${v}${o.unidad ? ` ${o.unidad}` : ''}`}${nota ? ` (${nota})` : ''}.`);
      }
    }
  }
  if (!lineas.length) return '';
  return `Convenio: ${cv.nombre}${cv.contraparte ? ` con ${cv.contraparte}` : ''}\nIncumplimientos de la parte municipal en los últimos 12 meses:\n${lineas.join('\n')}`;
}

export const conveniosRouter = Router();
const mesQ = z.object({ mes: z.string().regex(/^\d{4}-\d{2}$/).optional() });

conveniosRouter.get('/', async (req, res) => {
  const { mes = mesActual() } = mesQ.parse(req.query);
  const lista = await Convenio.find({ activo: true }).sort('-createdAt').lean();
  res.json({ tipos: TIPOS_OBL, estados: ESTADOS_OBL, items: await Promise.all(lista.map((c) => conEstados(c, mes))) });
});

conveniosRouter.get('/:id/resumen', async (req, res) => {
  const { mes = mesActual() } = mesQ.parse(req.query);
  const cv = await Convenio.findById(req.params.id).lean();
  if (!cv) throw new HttpError(404, 'Convenio no encontrado');
  res.json({ texto: await resumenIncumplimientos(cv, mes) });
});

const ADMIN = requireRole('administracion');
const convenioInput = z.object({ nombre: z.string().trim().min(2).max(160), contraparte: z.string().trim().max(160).optional(), desde: dateInput.optional(), hasta: dateInput.optional() });

conveniosRouter.post('/', ADMIN, async (req, res) => res.status(201).json(await Convenio.create(convenioInput.parse(req.body))));

conveniosRouter.patch('/:id', ADMIN, async (req, res) => {
  const cv = await Convenio.findById(req.params.id);
  if (!cv) throw new HttpError(404, 'Convenio no encontrado');
  cv.set(convenioInput.partial().parse(req.body));
  await cv.save();
  res.json(cv);
});

conveniosRouter.post('/:id/obligaciones', ADMIN, async (req, res) => {
  const o = z
    .object({ parte: z.enum(['Municipio', 'Organización']), que: z.string().trim().min(3).max(200), tipo: z.enum(Object.keys(TIPOS_OBL)), meta: z.number().min(0).optional(), unidad: z.string().trim().max(30).optional(), auto: z.boolean().optional() })
    .refine((d) => d.tipo === 'servicio' || d.meta != null, { message: 'Indicá lo pactado por mes', path: ['meta'] })
    .parse(req.body);
  const cv = await Convenio.findById(req.params.id);
  if (!cv) throw new HttpError(404, 'Convenio no encontrado');
  const ob = { id: `o${Date.now().toString(36)}`, ...o, ...(o.auto && { tipo: 'cantidad', unidad: 't' }) };
  cv.obligaciones.push(ob);
  await cv.save();
  res.status(201).json(ob);
});

conveniosRouter.delete('/:id/obligaciones/:oid', ADMIN, async (req, res) => {
  const cv = await Convenio.findById(req.params.id);
  if (!cv) throw new HttpError(404, 'Convenio no encontrado');
  const antes = cv.obligaciones.length;
  cv.obligaciones = cv.obligaciones.filter((o) => o.id !== req.params.oid);
  if (cv.obligaciones.length === antes) throw new HttpError(404, 'Obligación no encontrada');
  await cv.save();
  res.status(204).end();
});

/** Lo cumplido en el mes de una obligación (valor y nota). */
conveniosRouter.put('/:id/meses/:mes/:oid', ADMIN, async (req, res) => {
  const mes = z.string().regex(/^\d{4}-\d{2}$/).parse(req.params.mes);
  const d = z.object({ v: z.number().min(0).nullable().optional(), nota: z.string().trim().max(300).optional() }).parse(req.body);
  const cv = await Convenio.findById(req.params.id);
  if (!cv) throw new HttpError(404, 'Convenio no encontrado');
  const o = cv.obligaciones.find((x) => x.id === req.params.oid);
  if (!o) throw new HttpError(404, 'Obligación no encontrada');
  if (o.auto && d.v != null) throw new HttpError(422, 'Esta obligación se calcula sola con los ingresos de recolección municipal');
  if (o.tipo === 'servicio' && d.v != null && ![0, 1].includes(d.v)) throw new HttpError(422, 'Para "se cumple o no", el valor es 1 (sí) o 0 (no)');
  const actual = cv.meses?.[mes]?.[o.id] ?? {};
  cv.set(`meses.${mes}.${o.id}`, { ...actual, ...(d.v !== undefined && { v: d.v }), ...(d.nota !== undefined && { nota: d.nota }) });
  cv.markModified('meses');
  await cv.save();
  res.json({ mes, obligacion: o.id, ...cv.meses[mes][o.id] });
});

// ---------- Ingresos de caja ----------
const ingresoInput = z.object({ fecha: dateInput.optional(), concepto: z.enum(CONCEPTOS_INGRESO), detalle: z.string().max(200).optional(), monto: z.number().positive(), comprobante: z.string().max(60).optional() });
export const ingresosCajaRouter = crudRouter(IngresoCaja, { createSchema: ingresoInput, filters: ['concepto'], sort: '-fecha', writeRoles: ['administracion'] });
