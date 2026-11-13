import mongoose from 'mongoose';
import { z } from 'zod';
import { objectId, dateInput } from '../../lib/validation.js';

const { ObjectId } = mongoose.Schema.Types;

export const TIPOS_CLIENTE = ['generador', 'comprador', 'ambos'];
export const CONDICIONES_IVA = ['responsable_inscripto', 'monotributo', 'exento', 'consumidor_final'];
export const MODALIDADES = ['por_retiro', 'por_kg', 'abono_mensual', 'sin_cargo'];

const clientSchema = new mongoose.Schema(
  {
    tipo: { type: String, enum: TIPOS_CLIENTE, default: 'generador' },
    razonSocial: { type: String, required: true, trim: true },
    cuit: { type: String, trim: true, unique: true, sparse: true },
    condicionIva: { type: String, enum: CONDICIONES_IVA, default: 'responsable_inscripto' },
    contacto: {
      nombre: String,
      email: { type: String, lowercase: true, trim: true },
      telefono: String, // formato internacional para WhatsApp: 5493434xxxxxx
    },
    direcciones: [{ alias: String, direccion: { type: String, required: true }, lat: Number, lng: Number }],
    // Cómo se le cobra a este generador. Ver invoice.service.js
    tarifa: {
      modalidad: { type: String, enum: MODALIDADES, default: 'por_retiro' },
      montoFijo: { type: Number, default: 0, min: 0 }, // $ por retiro o $ del abono mensual
      preciosPorKg: [{ _id: false, material: { type: ObjectId, ref: 'Material', required: true }, precio: { type: Number, min: 0, required: true } }],
    },
    contrato: {
      numero: String,
      inicio: Date,
      fin: Date,
      frecuenciaRetiro: String, // "semanal", "martes y viernes", etc.
      diasPagoFactura: { type: Number, default: 15 },
    },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true },
);

clientSchema.index({ razonSocial: 'text' });

export const Client = mongoose.model('Client', clientSchema);

export const clientInput = z.object({
  tipo: z.enum(TIPOS_CLIENTE).default('generador'),
  razonSocial: z.string().min(2),
  cuit: z
    .string()
    .regex(/^\d{2}-?\d{8}-?\d$/, 'CUIT inválido')
    .transform((s) => s.replace(/-/g, ''))
    .optional(),
  condicionIva: z.enum(CONDICIONES_IVA).optional(),
  contacto: z
    .object({ nombre: z.string().optional(), email: z.string().email().optional(), telefono: z.string().optional() })
    .optional(),
  direcciones: z
    .array(z.object({ alias: z.string().optional(), direccion: z.string().min(3), lat: z.number().optional(), lng: z.number().optional() }))
    .optional(),
  tarifa: z
    .object({
      modalidad: z.enum(MODALIDADES),
      montoFijo: z.number().min(0).default(0),
      preciosPorKg: z.array(z.object({ material: objectId, precio: z.number().min(0) })).default([]),
    })
    .optional(),
  contrato: z
    .object({
      numero: z.string().optional(),
      inicio: dateInput.optional(),
      fin: dateInput.optional(),
      frecuenciaRetiro: z.string().optional(),
      diasPagoFactura: z.number().int().min(0).optional(),
    })
    .optional(),
  activo: z.boolean().optional(),
});
