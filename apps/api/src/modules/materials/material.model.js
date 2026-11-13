import mongoose from 'mongoose';
import { z } from 'zod';

export const CATEGORIAS = ['papel_carton', 'plasticos', 'vidrio', 'metales', 'electronicos', 'otros'];

const materialSchema = new mongoose.Schema(
  {
    codigo: { type: String, required: true, unique: true, uppercase: true, trim: true },
    nombre: { type: String, required: true, trim: true },
    categoria: { type: String, enum: CATEGORIAS, required: true },
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

export const Material = mongoose.model('Material', materialSchema);

export const materialInput = z.object({
  codigo: z.string().min(2).max(20),
  nombre: z.string().min(2),
  categoria: z.enum(CATEGORIAS),
  factorCo2: z.number().min(0).default(0),
  tarifaRetiroKg: z.number().min(0).default(0),
  precioVentaKg: z.number().min(0).default(0),
  activo: z.boolean().optional(),
});
