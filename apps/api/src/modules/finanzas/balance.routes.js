import { Router } from 'express';
import { z } from 'zod';
import { Gasto, CATEGORIAS_GASTO } from './gasto.model.js';
import { Sale } from '../plant/plant.models.js';
import { Invoice } from '../invoices/invoice.model.js';
import { dateInput, endOfLocalDay, startOfLocalMonth, round2 } from '../../lib/validation.js';

export const balanceRouter = Router();

const periodo = (q) => {
  const { desde, hasta } = z.object({ desde: dateInput.default(startOfLocalMonth()), hasta: dateInput.optional() }).parse(q);
  return { desde, hasta: hasta ? endOfLocalDay(hasta) : new Date() };
};

/**
 * Balance simple del período, en base a lo que efectivamente entró y salió:
 *  - ingresos: ventas de material cobradas + pagos recibidos de liquidaciones de servicio
 *  - egresos: gastos cargados
 *  - pendiente: ventas sin cobrar y saldos de liquidaciones (para no perderlos de vista)
 * Las ventas se imputan a su fecha (el sistema no guarda la fecha de cobro de la venta).
 */
async function calcularBalance(desde, hasta) {
  const [ventas, pagos, gastos, pendientes] = await Promise.all([
    Sale.find({ fecha: { $gte: desde, $lte: hasta } }).populate('comprador', 'razonSocial'),
    Invoice.aggregate([
      { $unwind: '$pagos' },
      { $match: { 'pagos.fecha': { $gte: desde, $lte: hasta } } },
      { $project: { fecha: '$pagos.fecha', monto: '$pagos.monto', numero: 1, cliente: '$clienteSnapshot.razonSocial', medio: '$pagos.medio' } },
    ]),
    Gasto.find({ fecha: { $gte: desde, $lte: hasta } }).sort('fecha'),
    Invoice.find({ estado: 'pendiente' }),
  ]);
  const ventasCobradas = ventas.filter((v) => v.cobrada);
  const sum = (arr, f) => round2(arr.reduce((a, x) => a + f(x), 0));
  const porCategoria = Object.entries(CATEGORIAS_GASTO)
    .map(([k, nombre]) => ({ categoria: k, nombre, monto: sum(gastos.filter((g) => g.categoria === k), (g) => g.monto) }))
    .filter((c) => c.monto > 0)
    .sort((a, b) => b.monto - a.monto);
  const ingresos = { ventasMaterial: sum(ventasCobradas, (v) => v.total), cobrosServicio: sum(pagos, (p) => p.monto) };
  const totalIngresos = round2(ingresos.ventasMaterial + ingresos.cobrosServicio);
  const totalEgresos = sum(gastos, (g) => g.monto);
  return {
    periodo: { desde, hasta },
    ingresos: { ...ingresos, total: totalIngresos },
    egresos: { total: totalEgresos, porCategoria },
    resultado: round2(totalIngresos - totalEgresos),
    pendiente: {
      ventasSinCobrar: sum(ventas.filter((v) => !v.cobrada), (v) => v.total),
      liquidacionesImpagas: sum(pendientes, (f) => f.saldo),
    },
    movimientos: [
      ...ventasCobradas.map((v) => ({ fecha: v.fecha, tipo: 'ingreso', concepto: `Venta de material${v.remito ? ` (${v.remito})` : ''}`, detalle: v.comprador?.razonSocial, categoria: 'ventas', monto: v.total })),
      ...pagos.map((p) => ({ fecha: p.fecha, tipo: 'ingreso', concepto: `Cobro liquidación N° ${p.numero}`, detalle: p.cliente, categoria: 'cobros', monto: p.monto })),
      ...gastos.map((g) => ({ fecha: g.fecha, tipo: 'egreso', concepto: g.descripcion, detalle: g.proveedor, categoria: g.categoria, monto: g.monto })),
    ].sort((a, b) => a.fecha - b.fecha),
  };
}

balanceRouter.get('/', async (req, res) => {
  const { desde, hasta } = periodo(req.query);
  res.json(await calcularBalance(desde, hasta));
});

// Exportación para el contador (se abre con Excel). Separador ";" y coma decimal, como usa Excel en español.
balanceRouter.get('/csv', async (req, res) => {
  const { desde, hasta } = periodo(req.query);
  const b = await calcularBalance(desde, hasta);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const num = (n) => String(n).replace('.', ',');
  const filas = [
    ['Fecha', 'Tipo', 'Concepto', 'Detalle', 'Categoría', 'Monto'],
    ...b.movimientos.map((m) => [m.fecha.toISOString().slice(0, 10), m.tipo, m.concepto, m.detalle, CATEGORIAS_GASTO[m.categoria] ?? m.categoria, (m.tipo === 'egreso' ? '-' : '') + num(m.monto)]),
    [],
    ['', '', 'Total ingresos', '', '', num(b.ingresos.total)],
    ['', '', 'Total egresos', '', '', '-' + num(b.egresos.total)],
    ['', '', 'Resultado', '', '', num(b.resultado)],
  ];
  const csv = '﻿' + filas.map((f) => f.map(esc).join(';')).join('\r\n'); // BOM para que Excel lea los acentos
  res.type('text/csv; charset=utf-8').setHeader('Content-Disposition', `attachment; filename="balance-${desde.toISOString().slice(0, 7)}.csv"`);
  res.send(csv);
});
