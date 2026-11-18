// Panel de resultados: KPIs del período vs. período anterior, desglose por clasificación y
// evolución mensual por categoría. Pensado para una pantalla estilo tablero (Manglai).
import { Movimiento } from '../movimientos/movimiento.model.js';
import { Sale } from '../plant/plant.models.js';
import { Certificate } from '../certificates/certificate.model.js';
import { Material } from '../materials/material.model.js';
import { FRACCIONES } from '../materials/fracciones.js';
import { round2 } from '../../lib/validation.js';

const DIA = 86400000;

/** Período: `anio` (año completo) o `anio-mm` (un mes). */
export function resolverPeriodo(p) {
  const m = /^(\d{4})(?:-(\d{2}))?$/.exec(p ?? '');
  const anio = Number(m?.[1] ?? new Date().getFullYear());
  if (m?.[2]) {
    const mes = Number(m[2]) - 1;
    const desde = new Date(anio, mes, 1);
    const hasta = new Date(anio, mes + 1, 1);
    return { desde, hasta, tipo: 'mes', etiqueta: desde.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }) };
  }
  return { desde: new Date(anio, 0, 1), hasta: new Date(anio + 1, 0, 1), tipo: 'anio', etiqueta: String(anio) };
}

/** Período inmediatamente anterior, de la misma longitud. */
function anterior({ desde, hasta, tipo }) {
  if (tipo === 'anio') return { desde: new Date(desde.getFullYear() - 1, 0, 1), hasta: new Date(hasta.getFullYear() - 1, 0, 1) };
  return { desde: new Date(desde.getFullYear(), desde.getMonth() - 1, 1), hasta: new Date(desde.getFullYear(), desde.getMonth(), 1) };
}

const rangeMatch = ({ desde, hasta }) => ({ fecha: { $gte: desde, $lt: hasta } });

async function totales(periodo) {
  const m = rangeMatch(periodo);
  const [ing, rech, ven, co2, retiros] = await Promise.all([
    Movimiento.aggregate([{ $match: { tipo: 'ingreso', ...m } }, { $group: { _id: null, kg: { $sum: '$kg' } } }]),
    Movimiento.aggregate([{ $match: { tipo: 'rechazo', ...m } }, { $group: { _id: null, kg: { $sum: { $abs: '$kg' } } } }]),
    Sale.aggregate([{ $match: m }, { $unwind: '$items' }, { $group: { _id: null, kg: { $sum: '$items.pesoKg' }, monto: { $sum: { $multiply: ['$items.pesoKg', '$items.precioKg'] } } } }]),
    Certificate.aggregate([{ $match: { fechaRetiro: { $gte: periodo.desde, $lt: periodo.hasta }, anulado: false } }, { $group: { _id: null, kg: { $sum: '$co2EvitadoKg' }, n: { $sum: 1 } } }]),
    Movimiento.distinct('ref.retiro', { tipo: 'ingreso', ...m, 'ref.retiro': { $exists: true, $ne: null } }),
  ]);
  const kgIng = ing[0]?.kg ?? 0;
  const kgRech = rech[0]?.kg ?? 0;
  const kgVen = ven[0]?.kg ?? 0;
  const monto = ven[0]?.monto ?? 0;
  const salidas = kgVen + kgRech;
  return {
    kgIngresado: round2(kgIng),
    kgVendido: round2(kgVen),
    kgRechazo: round2(kgRech),
    monto: round2(monto),
    co2Evitado: round2(co2[0]?.kg ?? 0),
    certificados: co2[0]?.n ?? 0,
    retiros: retiros.length,
    rechazoPct: kgIng ? round2((kgRech / kgIng) * 100) : null,
    valorizacionPct: salidas ? round2((kgVen / salidas) * 100) : null,
  };
}

const variacion = (actual, anterior) => {
  if (actual == null || anterior == null) return null;
  if (anterior === 0) return actual === 0 ? 0 : null;
  return round2(((actual - anterior) / anterior) * 100);
};

/**
 * Desglose por fracción (código de colores del Decreto 779/22): secos valorizables, metales,
 * plásticos, papel, vidrio, orgánicos y basura. Para el donut.
 */
async function porFraccion(periodo) {
  const r = await Movimiento.aggregate([
    { $match: { tipo: 'ingreso', ...rangeMatch(periodo) } },
    { $lookup: { from: 'materials', localField: 'material', foreignField: '_id', as: 'm' } },
    { $group: { _id: { $ifNull: [{ $first: '$m.fraccion' }, 'otros'] }, kg: { $sum: '$kg' } } },
    { $project: { _id: 0, fraccion: '$_id', kg: { $round: ['$kg', 2] } } },
  ]);
  const total = r.reduce((a, x) => a + x.kg, 0);
  return r
    .map((x) => ({
      ...x,
      nombre: FRACCIONES[x.fraccion]?.nombre ?? 'Otros',
      color: FRACCIONES[x.fraccion]?.hex ?? '#9ca3af',
      pct: total ? round2((x.kg / total) * 100) : 0,
    }))
    .sort((a, b) => b.kg - a.kg);
}

/** Top materiales por kg (para la pestaña "por material"). */
async function porMaterial(periodo) {
  const r = await Movimiento.aggregate([
    { $match: { tipo: 'ingreso', ...rangeMatch(periodo) } },
    { $group: { _id: '$material', kg: { $sum: '$kg' } } },
    { $lookup: { from: 'materials', localField: '_id', foreignField: '_id', as: 'm' } },
    { $project: { _id: 0, materialId: '$_id', material: { $first: '$m.nombre' }, color: { $ifNull: [{ $literal: null }, { $first: '$m.fraccion' }] }, kg: { $round: ['$kg', 2] } } },
    { $sort: { kg: -1 } },
    { $limit: 10 },
  ]);
  return r.map((x) => ({ ...x, color: FRACCIONES[x.color]?.hex ?? '#0f766e' }));
}

/** Top clientes por kg retirado (para la pestaña "por cliente"). */
async function porCliente(periodo) {
  const r = await Movimiento.aggregate([
    { $match: { tipo: 'ingreso', 'origen.cliente': { $ne: null }, ...rangeMatch(periodo) } },
    { $group: { _id: '$origen.cliente', kg: { $sum: '$kg' } } },
    { $lookup: { from: 'clients', localField: '_id', foreignField: '_id', as: 'c' } },
    { $project: { _id: 0, clienteId: '$_id', cliente: { $first: '$c.razonSocial' }, kg: { $round: ['$kg', 2] } } },
    { $sort: { kg: -1 } },
    { $limit: 10 },
  ]);
  return r;
}

/** Evolución mensual por fracción (área apilada: 12 meses del año). */
async function evolucionMensual(anio) {
  const r = await Movimiento.aggregate([
    { $match: { tipo: 'ingreso', fecha: { $gte: new Date(anio, 0, 1), $lt: new Date(anio + 1, 0, 1) } } },
    { $lookup: { from: 'materials', localField: 'material', foreignField: '_id', as: 'm' } },
    { $group: { _id: { mes: { $month: '$fecha' }, fraccion: { $ifNull: [{ $first: '$m.fraccion' }, 'otros'] } }, kg: { $sum: '$kg' } } },
  ]);
  // Series por fracción
  const fracciones = new Set(r.map((x) => x._id.fraccion));
  const series = [...fracciones].map((fr) => ({
    id: fr,
    nombre: FRACCIONES[fr]?.nombre ?? 'Otros',
    color: FRACCIONES[fr]?.hex ?? '#9ca3af',
    valores: Array.from({ length: 12 }, (_, i) => {
      const fila = r.find((x) => x._id.fraccion === fr && x._id.mes === i + 1);
      return round2(fila?.kg ?? 0);
    }),
  }));
  series.sort((a, b) => b.valores.reduce((s, v) => s + v, 0) - a.valores.reduce((s, v) => s + v, 0));
  return {
    meses: Array.from({ length: 12 }, (_, i) => new Date(anio, i, 1).toLocaleDateString('es-AR', { month: 'short' })),
    series,
  };
}

export async function panelResultados(periodoStr) {
  const periodo = resolverPeriodo(periodoStr);
  const prev = anterior(periodo);
  const [act, ant, fraccion, mats, cls, evol] = await Promise.all([
    totales(periodo),
    totales(prev),
    porFraccion(periodo),
    porMaterial(periodo),
    porCliente(periodo),
    evolucionMensual(periodo.desde.getFullYear()),
  ]);
  const kpi = (id, label, unidad, valor, previo, {ayuda, formato = 'num', tono = 'ok'} = {}) => ({ id, label, unidad, valor, previo, variacion: variacion(valor, previo), ayuda, formato, tono });
  return {
    periodo: { ...periodo, desde: periodo.desde.toISOString(), hasta: periodo.hasta.toISOString(), anterior: { desde: prev.desde.toISOString(), hasta: prev.hasta.toISOString() } },
    principales: [
      kpi('ingresado', 'Material ingresado', 'kg', act.kgIngresado, ant.kgIngresado, { ayuda: 'Kg que entraron a la planta en el período (libro de la planta).' }),
      kpi('vendido', 'Material vendido', 'kg', act.kgVendido, ant.kgVendido, { ayuda: 'Kg vendidos a la industria recicladora.' }),
      kpi('co2', 'CO₂ evitado', 'kg', act.co2Evitado, ant.co2Evitado, { ayuda: 'Emisiones evitadas por el reciclado (EPA WARM v16).' }),
    ],
    secundarias: [
      kpi('monto', 'Facturado por ventas', '$', act.monto, ant.monto, { formato: 'pesos' }),
      kpi('valorizacion', 'Valorización', '%', act.valorizacionPct, ant.valorizacionPct, { ayuda: 'Vendido sobre vendido + rechazo.' }),
      kpi('rechazo', 'Rechazo', '%', act.rechazoPct, ant.rechazoPct, { tono: 'malo', ayuda: 'Rechazo sobre lo ingresado. Objetivo: menos de 20 %.' }),
      kpi('retiros', 'Retiros a generadores', '', act.retiros, ant.retiros, { formato: 'entero' }),
      kpi('certificados', 'Certificados emitidos', '', act.certificados, ant.certificados, { formato: 'entero' }),
    ],
    fraccion,
    porMaterial: mats,
    porCliente: cls,
    evolucion: evol,
  };
}
