import mongoose from 'mongoose';
import { z } from 'zod';
import { tenantPlugin } from '../../lib/tenancy.js';
import { dateInput } from '../../lib/validation.js';

// Gastos de la operación. Junto con ventas y cobros dan el balance mensual que la
// cooperativa hoy no tiene (diagnóstico: "ausencia de balances contables periódicos").
// No reemplaza la contabilidad formal: se exporta para el contador.
export const CATEGORIAS_GASTO = {
  combustible: 'Combustible',
  reparaciones: 'Reparaciones y mantenimiento',
  repuestos: 'Repuestos e insumos',
  indumentaria: 'Indumentaria y seguridad',
  servicios: 'Servicios (luz, agua, internet)',
  retiros_socios: 'Retiros de socios',
  impuestos: 'Impuestos y tasas',
  otros: 'Otros',
};

const gastoSchema = new mongoose.Schema(
  {
    fecha: { type: Date, default: Date.now },
    categoria: { type: String, enum: Object.keys(CATEGORIAS_GASTO), required: true },
    descripcion: { type: String, required: true, trim: true },
    monto: { type: Number, required: true, min: 0 },
    proveedor: String,
    comprobante: String, // N° de factura o ticket
  },
  { timestamps: true },
);
gastoSchema.plugin(tenantPlugin);
gastoSchema.index({ coop: 1, fecha: -1 });

export const Gasto = mongoose.model('Gasto', gastoSchema);

export const gastoInput = z.object({
  fecha: dateInput.optional(),
  categoria: z.enum(Object.keys(CATEGORIAS_GASTO)),
  descripcion: z.string().min(2).max(200),
  monto: z.number().positive(),
  proveedor: z.string().max(120).optional(),
  comprobante: z.string().max(60).optional(),
});
