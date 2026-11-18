import mongoose from 'mongoose';
import { z } from 'zod';
import { tenantPlugin } from '../../lib/tenancy.js';
import { dateInput } from '../../lib/validation.js';

// Registros que piden las guías de productividad para plantas de clasificación y que el
// libro de movimientos no tiene: el personal del mes y las paradas de máquina.
// (Los accidentes se registran en Seguridad e higiene.)

export const mesInput = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mes inválido: usá AAAA-MM');

/** Resumen del personal de un mes: uno por mes y por cooperativa. */
const personalMesSchema = new mongoose.Schema(
  {
    mes: { type: String, required: true }, // AAAA-MM
    personas: { type: Number, required: true, min: 0 }, // incluye ausentes, accidentados y de vacaciones
    formalizadas: { type: Number, min: 0 }, // monotributo social o común, o relación de dependencia
    diasTrabajados: { type: Number, min: 0 }, // suma de días trabajados de todas las personas
    diasAusencia: { type: Number, min: 0 }, // días perdidos por ausentismo (personas con más de 3 meses)
    bajas: { type: Number, min: 0 }, // personas que se fueron en el mes
    ingresoPromedio: { type: Number, min: 0 }, // todo lo que cobra cada persona: retiros, subsidios, reparto de ventas
    smvm: { type: Number, min: 0 }, // salario mínimo, vital y móvil vigente ese mes
  },
  { timestamps: true },
);
personalMesSchema.plugin(tenantPlugin);
personalMesSchema.index({ coop: 1, mes: 1 }, { unique: true });
export const PersonalMes = mongoose.model('PersonalMes', personalMesSchema);

export const personalInput = z.object({
  personas: z.number().int().min(0).max(10000),
  formalizadas: z.number().int().min(0).optional(),
  diasTrabajados: z.number().min(0).optional(),
  diasAusencia: z.number().min(0).optional(),
  bajas: z.number().int().min(0).optional(),
  ingresoPromedio: z.number().min(0).optional(),
  smvm: z.number().min(0).optional(),
}).refine((p) => p.formalizadas == null || p.formalizadas <= p.personas, { message: 'Las personas formalizadas no pueden ser más que el total', path: ['formalizadas'] });

export const MAQUINAS = { cinta: 'Cinta de clasificación', prensa: 'Prensa / enfardadora', autoelevador: 'Autoelevador', molino: 'Molino', otra: 'Otra' };

/** Paradas de máquina (las guías cuentan las de más de medio turno). */
const paradaSchema = new mongoose.Schema(
  {
    fecha: { type: Date, default: Date.now },
    maquina: { type: String, enum: Object.keys(MAQUINAS), required: true },
    horas: { type: Number, required: true, min: 0.1 },
    causa: { type: String, enum: ['rotura', 'falta_material', 'falta_energia', 'mantenimiento', 'falta_personal', 'otra'], default: 'otra' },
    detalle: String,
  },
  { timestamps: true },
);
paradaSchema.plugin(tenantPlugin);
paradaSchema.index({ coop: 1, fecha: -1 });
export const ParadaMaquina = mongoose.model('ParadaMaquina', paradaSchema);

export const paradaInput = z.object({
  fecha: dateInput.optional(),
  maquina: z.enum(Object.keys(MAQUINAS)),
  horas: z.number().min(0.1).max(744),
  causa: z.enum(['rotura', 'falta_material', 'falta_energia', 'mantenimiento', 'falta_personal', 'otra']).optional(),
  detalle: z.string().max(300).optional(),
});
