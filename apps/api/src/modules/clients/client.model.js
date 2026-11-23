import mongoose from 'mongoose';
import { tenantPlugin } from '../../lib/tenancy.js';
import { z } from 'zod';
import { objectId, dateInput } from '../../lib/validation.js';

const { ObjectId } = mongoose.Schema.Types;

// generador: le retiramos residuos · comprador: le vendemos material · proveedor: le compramos
// material (cooperativa, acopiador, industria) · ambos: generador y comprador.
export const TIPOS_CLIENTE = ['generador', 'comprador', 'proveedor', 'ambos'];
/** Clientes a los que se les retira residuo (portal, agenda, facturación del servicio). */
export const esGenerador = (c) => ['generador', 'ambos'].includes(c?.tipo ?? 'generador');
export const CONDICIONES_IVA = ['responsable_inscripto', 'monotributo', 'exento', 'consumidor_final'];
export const MODALIDADES = ['por_retiro', 'por_kg', 'abono_mensual', 'sin_cargo'];

const clientSchema = new mongoose.Schema(
  {
    tipo: { type: String, enum: TIPOS_CLIENTE, default: 'generador' },
    razonSocial: { type: String, required: true, trim: true },
    rubro: { type: String, trim: true }, // cooperativa, acopiador, industria, gran generador…
    cuit: { type: String, trim: true }, // único por cooperativa (ver índice abajo)
    // Organización (empresa o municipio) con acceso al portal. Una misma organización puede
    // ser cliente de varias cooperativas: cada una tiene su propio registro Client vinculado.
    organizacion: { type: ObjectId, ref: 'Organization' },
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
    // Régimen de grandes generadores: datos jurisdiccionales para el certificado verde
    regimenGG: {
      jurisdiccion: String, // clave de REGIMENES_GG (caba, buenos_aires, cordoba…)
      nroRegistroGG: String, // N° inscripción en el registro de la jurisdicción
      categoriaGG: String, // categoría del generador (I/II/III en CABA, etc.)
      nroHabilitacionEspecial: String,
      categoriaYA: String, // categorías Y/A del residuo (PBA, Ley 11.720)
      codigoValorizacion: String, // R1–R13 (Basilea)
      categoriaResiduoCABA: String,
      clasificacionResiduo: String, // Córdoba: clasificación según Ley 9.088/10.208
    },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true },
);

clientSchema.index({ razonSocial: 'text' });

clientSchema.plugin(tenantPlugin);
clientSchema.index({ coop: 1, cuit: 1 }, { unique: true, partialFilterExpression: { cuit: { $type: 'string' } } });
clientSchema.index({ organizacion: 1 });

export const Client = mongoose.model('Client', clientSchema);

export const clientInput = z.object({
  tipo: z.enum(TIPOS_CLIENTE).default('generador'),
  razonSocial: z.string().min(2),
  rubro: z.string().max(80).optional(),
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
  regimenGG: z
    .object({
      jurisdiccion: z.string().optional(),
      nroRegistroGG: z.string().optional(),
      categoriaGG: z.string().optional(),
      nroHabilitacionEspecial: z.string().optional(),
      categoriaYA: z.string().optional(),
      codigoValorizacion: z.string().optional(),
      categoriaResiduoCABA: z.string().optional(),
      clasificacionResiduo: z.string().optional(),
    })
    .optional(),
  activo: z.boolean().optional(),
});
