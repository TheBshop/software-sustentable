import { Router } from 'express';
import { z } from 'zod';
import { Pickup } from '../pickups/pickup.model.js';
import { Sale } from '../plant/plant.models.js';
import { Certificate } from '../certificates/certificate.model.js';
import { paymentAlerts } from '../invoices/invoice.service.js';
import { indicadores } from '../movimientos/movimiento.service.js';
import { dateInput, endOfLocalDay, startOfLocalMonth } from '../../lib/validation.js';

export const dashboardRouter = Router();

const PESO = { $ifNull: ['$items.pesoRealKg', '$items.pesoEstimadoKg'] };

/**
 * GET /api/dashboard?desde=2026-11-01&hasta=2026-11-30
 * Métricas básicas del período (por defecto, el mes en curso).
 */
dashboardRouter.get('/', async (req, res) => {
  const now = new Date();
  const { desde, hasta } = z
    .object({
      desde: dateInput.default(startOfLocalMonth(now)),
      hasta: dateInput.optional(),
    })
    .parse(req.query);
  const hastaFin = hasta ? endOfLocalDay(hasta) : now;
  const matchRetiros = { fecha: { $gte: desde, $lte: hastaFin }, estado: { $ne: 'anulado' } };

  const [porMaterial, porCliente, totalesRetiros, ventasPorMaterial, co2, cobranzas, indPlanta] = await Promise.all([
    Pickup.aggregate([
      { $match: matchRetiros },
      { $unwind: '$items' },
      { $group: { _id: '$items.material', kg: { $sum: PESO } } },
      { $lookup: { from: 'materials', localField: '_id', foreignField: '_id', as: 'm' } },
      { $project: { _id: 0, materialId: '$_id', material: { $first: '$m.nombre' }, kg: { $round: ['$kg', 2] } } },
      { $sort: { kg: -1 } },
    ]),
    Pickup.aggregate([
      { $match: matchRetiros },
      { $unwind: '$items' },
      { $group: { _id: '$cliente', kg: { $sum: PESO }, retiros: { $addToSet: '$_id' } } },
      { $lookup: { from: 'clients', localField: '_id', foreignField: '_id', as: 'c' } },
      { $project: { _id: 0, clienteId: '$_id', cliente: { $first: '$c.razonSocial' }, kg: { $round: ['$kg', 2] }, retiros: { $size: '$retiros' } } },
      { $sort: { kg: -1 } },
      { $limit: 20 },
    ]),
    Pickup.countDocuments(matchRetiros),
    Sale.aggregate([
      { $match: { fecha: { $gte: desde, $lte: hastaFin } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.material', kg: { $sum: '$items.pesoKg' }, monto: { $sum: { $multiply: ['$items.pesoKg', '$items.precioKg'] } } } },
      { $lookup: { from: 'materials', localField: '_id', foreignField: '_id', as: 'm' } },
      { $project: { _id: 0, material: { $first: '$m.nombre' }, kg: { $round: ['$kg', 2] }, monto: { $round: ['$monto', 2] } } },
      { $sort: { monto: -1 } },
    ]),
    Certificate.aggregate([
      { $match: { fechaRetiro: { $gte: desde, $lte: hastaFin }, anulado: false } },
      { $group: { _id: null, kg: { $sum: '$co2EvitadoKg' } } },
    ]),
    paymentAlerts(7),
    indicadores(desde, hastaFin),
  ]);

  res.json({
    periodo: { desde, hasta: hastaFin },
    totales: {
      retiros: totalesRetiros,
      kgRecuperados: Math.round(porMaterial.reduce((a, m) => a + m.kg, 0) * 100) / 100,
      co2EvitadoKg: co2[0]?.kg ?? 0,
      ventas: Math.round(ventasPorMaterial.reduce((a, v) => a + v.monto, 0) * 100) / 100,
      cobrosVencidos: cobranzas.totalVencido,
      cobrosPorVencer: cobranzas.totalPorVencer,
    },
    porMaterial,
    porCliente,
    ventasPorMaterial,
    // Trazabilidad de planta (libro de movimientos): Decreto 779/22, Anexo I, art. 6 inc. g
    planta: { indicadores: indPlanta },
  });
});
