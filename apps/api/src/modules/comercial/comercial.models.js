// Comercial: contratos de venta, convenio con el municipio e ingresos de caja.
import mongoose from 'mongoose';
import { TIPOS_OBL, CONCEPTOS } from '@nueva-vida/catalogos';
import { tenantPlugin } from '../../lib/tenancy.js';

const { ObjectId } = mongoose.Schema.Types;

// Contrato de venta: kg pactados de un material con un comprador, a un precio y en un plazo.
// El avance sale de las ventas registradas (no se carga a mano).
const contratoSchema = new mongoose.Schema(
  {
    comprador: { type: ObjectId, ref: 'Client', required: true },
    material: { type: ObjectId, ref: 'Material', required: true },
    kg: { type: Number, required: true, min: 0 },
    precioKg: { type: Number, required: true, min: 0 },
    desde: { type: Date, required: true },
    hasta: { type: Date, required: true },
    numero: String,
    notas: String,
    activo: { type: Boolean, default: true },
  },
  { timestamps: true },
);
contratoSchema.plugin(tenantPlugin);
export const Contrato = mongoose.model('Contrato', contratoSchema);

// Convenio con el municipio: obligaciones de cada parte y su cumplimiento mes a mes.
//   tipo cantidad → meta por mes (t, viajes, personas) · pago → $ por mes · servicio → se cumple o no
//   auto → la cantidad sale de los ingresos de "recolección municipal" del libro de la planta (t)
const convenioSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    contraparte: { type: String, trim: true }, // Municipalidad de…
    desde: Date,
    hasta: Date,
    obligaciones: [
      {
        _id: false,
        id: { type: String, required: true },
        parte: { type: String, enum: ['Municipio', 'Organización'], required: true },
        que: { type: String, required: true },
        tipo: { type: String, enum: Object.keys(TIPOS_OBL), required: true },
        meta: Number,
        unidad: String,
        auto: { type: Boolean, default: false },
      },
    ],
    // { '2026-11': { o1: { v: 180, nota: '…' } } }
    meses: { type: mongoose.Schema.Types.Mixed, default: {} },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true, minimize: false },
);
convenioSchema.plugin(tenantPlugin);
export const Convenio = mongoose.model('Convenio', convenioSchema);

// Ingresos de caja que no son ventas de material ni cobros de liquidaciones
// (pago del municipio, subsidios, servicio a grandes generadores). Los egresos son Gastos.
export const CONCEPTOS_INGRESO = CONCEPTOS.Ingreso;
const ingresoCajaSchema = new mongoose.Schema(
  {
    fecha: { type: Date, default: Date.now },
    concepto: { type: String, enum: CONCEPTOS_INGRESO, required: true },
    detalle: { type: String, trim: true },
    monto: { type: Number, required: true, min: 0 },
    comprobante: String,
  },
  { timestamps: true },
);
ingresoCajaSchema.plugin(tenantPlugin);
export const IngresoCaja = mongoose.model('IngresoCaja', ingresoCajaSchema);
