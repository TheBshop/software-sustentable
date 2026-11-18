// Proceso de planta: lotes (recepción → clasificado → enfardado → vendido) y remitos.
import mongoose from 'mongoose';
import { tenantPlugin } from '../../lib/tenancy.js';

const { ObjectId } = mongoose.Schema.Types;

// 'derivado': lote de material mezclado que ya se clasificó en lotes de cada material.
export const ETAPAS_LOTE = ['recepcion', 'clasificado', 'enfardado', 'vendido', 'derivado'];
export const SIGUIENTE = { recepcion: 'clasificado', clasificado: 'enfardado' };

const loteSchema = new mongoose.Schema(
  {
    numero: { type: Number, required: true },
    fecha: { type: Date, default: Date.now },
    material: { type: ObjectId, ref: 'Material', required: true },
    kgIngreso: { type: Number, required: true, min: 0 },
    kg: { type: Number, required: true, min: 0 }, // kg actuales del lote
    estimado: { type: Boolean, default: false }, // peso sin báscula
    etapa: { type: String, enum: ETAPAS_LOTE, default: 'recepcion' },
    origen: {
      tipo: String, // retiro, recoleccion_municipal, recuperador, entrega_voluntaria, otro, clasificacion
      cliente: { type: ObjectId, ref: 'Client' },
      ingreso: { type: ObjectId, ref: 'Intake' },
      retiro: { type: ObjectId, ref: 'Pickup' },
      lote: { type: ObjectId, ref: 'Lote' }, // lote mezclado del que salió
    },
    // Control al recibir
    control: { type: String, enum: ['Sin controlar', 'Apto', 'Húmedo', 'Mezclado', 'Contaminado'], default: 'Sin controlar' },
    humedad: Number,
    kgSeparado: Number,
    kgRechazo: Number,
    causaRechazo: String,
    // Enfardado
    unidades: Number,
    kgFinal: Number,
    // Venta
    venta: { type: ObjectId, ref: 'Sale' },
    remito: { type: ObjectId, ref: 'Remito' },
    historial: [{ _id: false, etapa: String, fecha: { type: Date, default: Date.now }, usuario: { type: ObjectId, ref: 'User' }, kg: Number }],
  },
  { timestamps: true },
);
loteSchema.plugin(tenantPlugin);
loteSchema.index({ coop: 1, numero: 1 }, { unique: true });
loteSchema.index({ coop: 1, etapa: 1, fecha: -1 });
export const Lote = mongoose.model('Lote', loteSchema);

// Remito: numeración correlativa sin saltos (lib/counters.js). No se borra: se anula.
const remitoSchema = new mongoose.Schema(
  {
    numero: { type: Number, required: true },
    fecha: { type: Date, default: Date.now },
    tipo: { type: String, enum: ['venta', 'traslado'], default: 'venta' },
    destinatario: { type: ObjectId, ref: 'Client', required: true },
    items: [{ _id: false, material: { type: ObjectId, ref: 'Material', required: true }, kg: { type: Number, required: true, min: 0 }, lote: { type: ObjectId, ref: 'Lote' }, unidades: Number }],
    pesaje: { type: String, enum: ['Báscula', 'Estimado'], default: 'Báscula' },
    transporte: { razonSocial: String, patente: String, chofer: String },
    observaciones: String,
    venta: { type: ObjectId, ref: 'Sale' },
    anulado: { type: Boolean, default: false },
    motivoAnulacion: String,
  },
  { timestamps: true },
);
remitoSchema.plugin(tenantPlugin);
remitoSchema.index({ coop: 1, numero: 1 }, { unique: true });
export const Remito = mongoose.model('Remito', remitoSchema);

export const fmtLote = (n) => `L-${String(n).padStart(4, '0')}`;
export const fmtRemito = (n) => `R-${String(n).padStart(6, '0')}`;
