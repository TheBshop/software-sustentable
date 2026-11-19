// Presupuestos (cotizaciones): documento previo a la factura, sin validez fiscal.
// Se envía al potencial cliente; cuando lo acepta, se convierte en factura.
import mongoose from 'mongoose';
import { tenantPlugin } from '../../lib/tenancy.js';

const { ObjectId } = mongoose.Schema.Types;

export const ESTADOS_PRESUPUESTO = ['vigente', 'aceptado', 'rechazado', 'vencido', 'convertido'];

const presupuestoSchema = new mongoose.Schema(
  {
    numero: Number, // correlativo por cooperativa
    cliente: { type: ObjectId, ref: 'Client', required: true },
    clienteSnapshot: { razonSocial: String, cuit: String, condicionIva: String },
    lineas: [{ _id: false, descripcion: { type: String, required: true }, cantidad: Number, unidad: String, precioUnitario: Number, subtotal: Number }],
    total: { type: Number, required: true },
    emitidoEn: { type: Date, default: Date.now },
    vigenciaHasta: { type: Date, required: true },
    estado: { type: String, enum: ESTADOS_PRESUPUESTO, default: 'vigente' },
    notas: { type: String, trim: true },
    facturaGenerada: { type: ObjectId, ref: 'Invoice' },
  },
  { timestamps: true },
);

presupuestoSchema.virtual('vencido').get(function () {
  return this.estado === 'vigente' && this.vigenciaHasta < new Date();
});

presupuestoSchema.plugin(tenantPlugin);
presupuestoSchema.index({ coop: 1, numero: 1 }, { unique: true });

export const Presupuesto = mongoose.model('Presupuesto', presupuestoSchema);
