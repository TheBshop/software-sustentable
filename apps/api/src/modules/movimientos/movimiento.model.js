import mongoose from 'mongoose';
import { tenantPlugin } from '../../lib/tenancy.js';
import { ETAPAS } from '../materials/fracciones.js';

const { ObjectId } = mongoose.Schema.Types;

// Libro de movimientos de planta: registro de SOLO AGREGADO (inspirado en event sourcing).
// El stock y los indicadores se calculan sumando movimientos; nunca se editan ni se borran.
// Las correcciones se registran como movimientos de "ajuste".
// Cumple el criterio de trazabilidad del Decreto 779/2022 (Anexo I, art. 6 inc. g):
// conocer stocks, flujos y cantidades valorizadas y dispuestas, desagregadas por etapa.
export const TIPOS_MOVIMIENTO = ['ingreso', 'venta', 'rechazo', 'ajuste'];
export const DESTINOS = ['valorizacion', 'disposicion_final'];

const movimientoSchema = new mongoose.Schema(
  {
    fecha: { type: Date, default: Date.now },
    tipo: { type: String, enum: TIPOS_MOVIMIENTO, required: true },
    material: { type: ObjectId, ref: 'Material', required: true },
    // Con signo: ingreso (+), venta (−), rechazo (−), ajuste (±)
    kg: { type: Number, required: true },
    etapa: { type: String, enum: ETAPAS, required: true }, // Ley 25.916, art. 3
    destino: { type: String, enum: DESTINOS }, // solo para salidas de planta
    ref: { retiro: { type: ObjectId, ref: 'Pickup' }, ingreso: { type: ObjectId, ref: 'Intake' }, venta: { type: ObjectId, ref: 'Sale' } },
    usuario: { type: ObjectId, ref: 'User' },
    motivo: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const inmutable = () => {
  throw new Error('Los movimientos no se modifican ni se borran: registrá un ajuste');
};
movimientoSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace', 'deleteOne', 'deleteMany', 'findOneAndDelete'], inmutable);
movimientoSchema.pre('save', function () {
  if (!this.isNew) inmutable();
});

movimientoSchema.plugin(tenantPlugin);
movimientoSchema.index({ coop: 1, material: 1, fecha: -1 });
movimientoSchema.index({ coop: 1, tipo: 1, fecha: -1 });

export const Movimiento = mongoose.model('Movimiento', movimientoSchema);
