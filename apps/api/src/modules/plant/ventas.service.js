import { Router } from 'express';
import { z } from 'zod';
import { Material } from '../materials/material.model.js';
import { Sale } from './plant.models.js';
import { dateInput, endOfLocalDay, round2 } from '../../lib/validation.js';

// Ventas contra el precio de mercado. El diagnóstico de la cooperativa detectó ventas por
// debajo del precio de referencia (ej. cartón a $85/kg con un mercado de $120 a $240).

/** Guarda en cada renglón el rango de referencia vigente (foto del momento de la venta). */
export async function anotarReferencias(data) {
  const mats = new Map((await Material.find({ _id: { $in: data.items.map((i) => i.material) } })).map((m) => [String(m._id), m]));
  data.items = data.items.map((i) => {
    const ref = mats.get(String(i.material))?.precioReferencia;
    return { ...i, referenciaMinKg: ref?.minKg ?? undefined, referenciaMaxKg: ref?.maxKg ?? undefined };
  });
}

/** Avisos para el operador: renglones vendidos por debajo del mínimo de referencia. */
export async function avisosPrecio(sale) {
  const debajo = sale.items.filter((i) => i.referenciaMinKg != null && i.precioKg < i.referenciaMinKg);
  if (!debajo.length) return [];
  const nombres = new Map((await Material.find({ _id: { $in: debajo.map((i) => i.material) } }).select('nombre')).map((m) => [String(m._id), m.nombre]));
  return debajo.map((i) => {
    const perdidaKg = i.referenciaMinKg - i.precioKg;
    return {
      material: nombres.get(String(i.material)),
      precioKg: i.precioKg,
      referenciaMinKg: i.referenciaMinKg,
      referenciaMaxKg: i.referenciaMaxKg,
      diferenciaTotal: round2(perdidaKg * i.pesoKg), // cuánto se dejó de ganar respecto del mínimo
      mensaje: `${nombres.get(String(i.material))}: vendido a $${i.precioKg}/kg, por debajo del mínimo de mercado ($${i.referenciaMinKg}/kg)`,
    };
  });
}

// GET /api/ventas/resumen?desde&hasta → precio promedio por comprador y material
export const ventasResumenRouter = Router();
ventasResumenRouter.get('/resumen', async (req, res) => {
  const { desde, hasta } = z.object({ desde: dateInput.default(new Date(0)), hasta: dateInput.optional() }).parse(req.query);
  const filas = await Sale.aggregate([
    { $match: { fecha: { $gte: desde, $lte: hasta ? endOfLocalDay(hasta) : new Date() } } },
    { $unwind: '$items' },
    {
      $group: {
        _id: { comprador: '$comprador', material: '$items.material' },
        kg: { $sum: '$items.pesoKg' },
        monto: { $sum: { $multiply: ['$items.pesoKg', '$items.precioKg'] } },
        ventas: { $sum: 1 },
        debajo: { $sum: { $cond: [{ $lt: ['$items.precioKg', { $ifNull: ['$items.referenciaMinKg', -1] }] }, 1, 0] } },
        ultimaVenta: { $max: '$fecha' },
      },
    },
    { $lookup: { from: 'clients', localField: '_id.comprador', foreignField: '_id', as: 'c' } },
    { $lookup: { from: 'materials', localField: '_id.material', foreignField: '_id', as: 'm' } },
    {
      $project: {
        _id: 0,
        comprador: { $first: '$c.razonSocial' },
        material: { $first: '$m.nombre' },
        referencia: { $first: '$m.precioReferencia' },
        kg: { $round: ['$kg', 2] },
        monto: { $round: ['$monto', 2] },
        precioPromedioKg: { $round: [{ $divide: ['$monto', '$kg'] }, 2] },
        ventas: 1,
        ventasDebajoDeReferencia: '$debajo',
        ultimaVenta: 1,
      },
    },
    { $sort: { material: 1, precioPromedioKg: -1 } },
  ]);
  res.json({ items: filas });
});
