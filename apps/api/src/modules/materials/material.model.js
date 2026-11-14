import mongoose from 'mongoose';
import { tenantPlugin } from '../../lib/tenancy.js';
import { z } from 'zod';
import { CORRIENTES } from '../organizations/organization.model.js';
import { FRACCIONES, SUBTIPOS_REGU, FRACCION_POR_CATEGORIA } from './fracciones.js';

export const CATEGORIAS = ['papel_carton', 'plasticos', 'vidrio', 'metales', 'electronicos', 'otros'];

const materialSchema = new mongoose.Schema(
  {
    codigo: { type: String, required: true, uppercase: true, trim: true }, // único por cooperativa
    nombre: { type: String, required: true, trim: true },
    categoria: { type: String, enum: CATEGORIAS, required: true },
    // Clasificación normativa (docs/08-marco-normativo.md)
    corriente: { type: String, enum: CORRIENTES, default: 'rsu' },
    fraccion: { type: String, enum: Object.keys(FRACCIONES) }, // solo corriente "rsu" (Decreto 779/22, Anexo II)
    subtipoRegu: { type: String, enum: Object.keys(SUBTIPOS_REGU) }, // solo corriente "regu"
    valorizable: { type: Boolean, default: true }, // false = va a disposición final
    // kg de CO2e evitados por cada kg recuperado. Configurable: la cooperativa debe validar
    // los factores con una fuente reconocida (ver docs/02-modelo-de-datos.md).
    factorCo2: { type: Number, default: 0, min: 0 },
    // Tarifa por defecto que se cobra al generador por kg retirado (puede ser 0).
    tarifaRetiroKg: { type: Number, default: 0, min: 0 },
    // Precio de referencia por kg al vender el material a compradores.
    precioVentaKg: { type: Number, default: 0, min: 0 },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Completa la fracción a partir de la categoría si no se indicó (RSU), y la limpia si no aplica.
materialSchema.pre('validate', function () {
  if (this.corriente === 'rsu') {
    if (!this.fraccion) this.fraccion = FRACCION_POR_CATEGORIA[this.categoria] ?? 'secos_valorizables';
    this.subtipoRegu = undefined;
  } else {
    this.fraccion = undefined;
    if (this.corriente !== 'regu') this.subtipoRegu = undefined;
  }
  if (this.fraccion === 'basura') this.valorizable = false;
});

materialSchema.plugin(tenantPlugin);
materialSchema.index({ coop: 1, codigo: 1 }, { unique: true });

export const Material = mongoose.model('Material', materialSchema);

const materialBase = z.object({
    codigo: z.string().min(2).max(20),
    nombre: z.string().min(2),
    categoria: z.enum(CATEGORIAS),
    corriente: z.enum(CORRIENTES).default('rsu'),
    fraccion: z.enum(Object.keys(FRACCIONES)).optional(),
    subtipoRegu: z.enum(Object.keys(SUBTIPOS_REGU)).optional(),
    valorizable: z.boolean().optional(),
    factorCo2: z.number().min(0).default(0),
    tarifaRetiroKg: z.number().min(0).default(0),
    precioVentaKg: z.number().min(0).default(0),
    activo: z.boolean().optional(),
});

const reguConSubtipo = [(m) => m.corriente !== 'regu' || m.subtipoRegu, { message: 'Indicá el tipo de residuo especial (REGU)', path: ['subtipoRegu'] }];

export const materialInput = materialBase.refine(...reguConSubtipo);
export const materialUpdate = materialBase.partial().refine(...reguConSubtipo);
