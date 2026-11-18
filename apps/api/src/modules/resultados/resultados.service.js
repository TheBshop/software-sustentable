// Resultados: huella de carbono (Alcances 1 y 2 con SNIGEI-AR 2025), emisiones evitadas por
// material vendido (EPA WARM v16) y memoria anual. Los datos salen del libro de la planta,
// de las ventas, y de los registros de combustible y electricidad.
import { FE, feCO2e, fWarm, FUENTE_FE, URL_FE, FUENTE_WARM, URL_WARM, PCG } from '@nueva-vida/catalogos';
import { Movimiento } from '../movimientos/movimiento.model.js';
import { Sale } from '../plant/plant.models.js';
import { RegistroServicio } from '../registros/registro.model.js';
import { parseLocalDate, round2 } from '../../lib/validation.js';

const rangoAnio = (anio) => ({ $gte: parseLocalDate(`${anio}-01-01`), $lt: parseLocalDate(`${Number(anio) + 1}-01-01`) });
const rangoMes = (mes) => {
  const d = parseLocalDate(`${mes}-01`);
  const f = new Date(d);
  f.setMonth(f.getMonth() + 1);
  return { $gte: d, $lt: f };
};

/** Huella de un mes: combustibles (A1), electricidad (A2) y bioCO₂ aparte. */
export async function huellaMes(mes) {
  const [comb, elec, ingKg] = await Promise.all([
    RegistroServicio.find({ registro: 'combustible', fecha: rangoMes(mes) }).lean(),
    RegistroServicio.find({ registro: 'electricidad', fecha: rangoMes(mes) }).lean(),
    Movimiento.aggregate([{ $match: { tipo: 'ingreso', fecha: rangoMes(mes) } }, { $group: { _id: null, kg: { $sum: '$kg' } } }]),
  ]);
  let a1 = 0;
  let bio = 0;
  for (const c of comb) {
    const litros = Number(c.datos?.litros ?? 0);
    const fe = FE[c.datos?.combustible] ?? FE.Gasoil;
    a1 += litros * feCO2e(fe);
    bio += litros * (fe.bio ?? 0);
  }
  const kwh = elec.reduce((a, e) => a + Number(e.datos?.kwh ?? 0), 0);
  const a2 = kwh * feCO2e(FE.Electricidad);
  return { mes, a1: round2(a1), a2: round2(a2), total: round2(a1 + a2), bio: round2(bio), t: round2((ingKg[0]?.kg ?? 0) / 1000), hay: comb.length > 0 || elec.length > 0 };
}

/** Huella de un año completo, mes a mes. */
export async function huellaAnual(anio) {
  const meses = Array.from({ length: 12 }, (_, i) => `${anio}-${String(i + 1).padStart(2, '0')}`);
  const filas = await Promise.all(meses.map(huellaMes));
  const tot = filas.reduce((a, x) => ({ a1: a.a1 + x.a1, a2: a.a2 + x.a2, bio: a.bio + x.bio, t: a.t + x.t }), { a1: 0, a2: 0, bio: 0, t: 0 });
  return {
    anio,
    filas: filas.filter((f) => f.hay || f.t),
    total: { a1: round2(tot.a1), a2: round2(tot.a2), bio: round2(tot.bio), t: round2(tot.t), kg: round2(tot.a1 + tot.a2), porTonelada: tot.t ? round2((tot.a1 + tot.a2) / tot.t) : null },
    fuente: { nombre: FUENTE_FE, url: URL_FE, pcg: PCG },
    factores: FE,
  };
}

/** Emisiones evitadas por el material vendido (EPA WARM v16). */
export async function evitadasAnuales(anio) {
  const ventas = await Sale.aggregate([
    { $match: { fecha: rangoAnio(anio) } },
    { $unwind: '$items' },
    { $group: { _id: '$items.material', kg: { $sum: '$items.pesoKg' } } },
    { $lookup: { from: 'materials', localField: '_id', foreignField: '_id', as: 'm' } },
    { $project: { _id: 0, material: { $first: '$m.nombre' }, kg: { $round: ['$kg', 2] } } },
  ]);
  const filas = ventas
    .map((v) => {
      const f = fWarm(v.material);
      return { material: v.material, kg: v.kg, factor: f && { nombre: f.nombre, kg: round2(f.kg), st: f.st }, evitado: f ? round2(v.kg * f.kg) : null, bosque: f ? round2(v.kg * f.bosque) : null };
    })
    .sort((a, b) => (b.evitado ?? -1) - (a.evitado ?? -1));
  const tot = filas.reduce((a, x) => ({ ev: a.ev + (x.evitado ?? 0), bos: a.bos + (x.bosque ?? 0), sin: a.sin + (x.factor ? 0 : x.kg) }), { ev: 0, bos: 0, sin: 0 });
  return { anio, filas, total: { evitadoKg: round2(tot.ev), bosqueKg: round2(tot.bos), sinFactorKg: round2(tot.sin) }, fuente: { nombre: FUENTE_WARM, url: URL_WARM } };
}

/** Resumen anual para la memoria (y el PDF/Excel). */
export async function memoriaAnual(anio) {
  const match = { fecha: rangoAnio(anio) };
  const [ingresos, ventasBrutas, rechazoAgg, origenes, compradores, causas, ventasMat] = await Promise.all([
    Movimiento.aggregate([{ $match: { tipo: 'ingreso', ...match } }, { $group: { _id: null, kg: { $sum: '$kg' } } }]),
    Sale.aggregate([{ $match: match }, { $unwind: '$items' }, { $group: { _id: null, kg: { $sum: '$items.pesoKg' }, monto: { $sum: { $multiply: ['$items.pesoKg', '$items.precioKg'] } } } }]),
    Movimiento.aggregate([{ $match: { tipo: 'rechazo', ...match } }, { $group: { _id: null, kg: { $sum: { $abs: '$kg' } } } }]),
    Movimiento.aggregate([
      { $match: { tipo: 'ingreso', ...match } },
      { $group: { _id: '$origen.tipo', kg: { $sum: '$kg' } } },
      { $project: { _id: 0, origen: '$_id', kg: { $round: ['$kg', 2] } } },
      { $sort: { kg: -1 } },
    ]),
    Sale.aggregate([{ $match: match }, { $group: { _id: '$comprador', kg: { $sum: { $sum: '$items.pesoKg' } } } }, { $lookup: { from: 'clients', localField: '_id', foreignField: '_id', as: 'c' } }, { $project: { _id: 0, comprador: { $first: '$c.razonSocial' }, kg: { $round: ['$kg', 2] } } }, { $sort: { kg: -1 } }, { $limit: 10 }]),
    Movimiento.aggregate([
      { $match: { tipo: 'rechazo', ...match } },
      { $group: { _id: '$causa', kg: { $sum: { $abs: '$kg' } } } },
      { $project: { _id: 0, causa: { $ifNull: ['$_id', 'sin_causa'] }, kg: { $round: ['$kg', 2] } } },
      { $sort: { kg: -1 } },
    ]),
    Sale.aggregate([{ $match: match }, { $unwind: '$items' }, { $group: { _id: '$items.material', kg: { $sum: '$items.pesoKg' }, monto: { $sum: { $multiply: ['$items.pesoKg', '$items.precioKg'] } } } }, { $lookup: { from: 'materials', localField: '_id', foreignField: '_id', as: 'm' } }, { $project: { _id: 0, material: { $first: '$m.nombre' }, kg: { $round: ['$kg', 2] }, monto: { $round: ['$monto', 2] } } }, { $sort: { monto: -1 } }]),
  ]);
  const [huella, evitadas] = await Promise.all([huellaAnual(anio), evitadasAnuales(anio)]);
  const kgEnt = round2(ingresos[0]?.kg ?? 0);
  const kgVen = round2(ventasBrutas[0]?.kg ?? 0);
  const kgRech = round2(rechazoAgg[0]?.kg ?? 0);
  const salidas = kgVen + kgRech;
  return {
    anio,
    totales: {
      ingresadoKg: kgEnt,
      vendidoKg: kgVen,
      rechazoKg: kgRech,
      monto: round2(ventasBrutas[0]?.monto ?? 0),
      valorizacion: salidas ? round2((kgVen / salidas) * 100) : null,
      huellaKg: huella.total.kg,
      evitadoKg: evitadas.total.evitadoKg,
    },
    porOrigen: origenes,
    porCausa: causas,
    ventasMaterial: ventasMat,
    compradores,
    huella,
    evitadas,
  };
}

/** Informe por cliente/generador: kg retirados por material y certificados emitidos en el año. */
export async function informePorCliente(anio) {
  const match = { fecha: rangoAnio(anio) };
  const { Certificate } = await import('../certificates/certificate.model.js');
  const [intake, certs] = await Promise.all([
    Movimiento.aggregate([
      { $match: { tipo: 'ingreso', 'origen.cliente': { $ne: null }, ...match } },
      { $group: { _id: { cliente: '$origen.cliente', material: '$material' }, kg: { $sum: '$kg' } } },
      { $lookup: { from: 'clients', localField: '_id.cliente', foreignField: '_id', as: 'c' } },
      { $lookup: { from: 'materials', localField: '_id.material', foreignField: '_id', as: 'm' } },
      { $project: { _id: 0, clienteId: '$_id.cliente', cliente: { $first: '$c.razonSocial' }, material: { $first: '$m.nombre' }, kg: { $round: ['$kg', 2] } } },
    ]),
    Certificate.aggregate([{ $match: { fechaRetiro: rangoAnio(anio), anulado: false } }, { $group: { _id: '$cliente', certificados: { $sum: 1 }, co2: { $sum: '$co2EvitadoKg' } } }]),
  ]);
  const certMap = new Map(certs.map((c) => [String(c._id), c]));
  const porCliente = new Map();
  for (const r of intake) {
    const k = String(r.clienteId);
    const entrada = porCliente.get(k) ?? { clienteId: r.clienteId, cliente: r.cliente, materiales: [], kgTotal: 0 };
    entrada.materiales.push({ material: r.material, kg: r.kg });
    entrada.kgTotal = round2(entrada.kgTotal + r.kg);
    porCliente.set(k, entrada);
  }
  for (const [k, v] of porCliente) {
    const c = certMap.get(k);
    v.certificados = c?.certificados ?? 0;
    v.co2EvitadoKg = round2(c?.co2 ?? 0);
  }
  return { anio, items: [...porCliente.values()].sort((a, b) => b.kgTotal - a.kgTotal) };
}
