import mongoose from 'mongoose';
import { tenantPlugin } from '../../lib/tenancy.js';

const { ObjectId } = mongoose.Schema.Types;

export const TIPOS_ENVASE = [
  'pet', 'pead', 'pvc', 'pebd', 'pp', 'ps', 'otros_plasticos',
  'carton_corrugado', 'carton_compacto', 'papel', 'papel_diario',
  'vidrio_transparente', 'vidrio_color',
  'aluminio', 'hojalata', 'acero',
  'tetra_pak', 'flexible_multicapa',
  'otro',
];

const lineaSchema = new mongoose.Schema({
  tipoEnvase: { type: String, enum: TIPOS_ENVASE, required: true },
  descripcion: String,
  pesoKg: { type: Number, required: true, min: 0 },
  co2EvitadoKg: Number,
}, { _id: false });

const marcaSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true },
  cuit: { type: String, trim: true },
  contacto: { nombre: String, email: String, telefono: String },
  direccion: String,
  activo: { type: Boolean, default: true },
}, { timestamps: true });

marcaSchema.plugin(tenantPlugin);
marcaSchema.index({ coop: 1, nombre: 1 }, { unique: true });

export const MarcaEPR = mongoose.model('MarcaEPR', marcaSchema);

const reporteSchema = new mongoose.Schema({
  numero: { type: Number, index: true },
  marca: { type: ObjectId, ref: 'MarcaEPR', required: true },
  marcaSnapshot: { nombre: String, cuit: String },
  periodo: { desde: { type: Date, required: true }, hasta: { type: Date, required: true } },
  lineas: { type: [lineaSchema], required: true },
  totalKg: { type: Number, default: 0 },
  co2EvitadoKg: { type: Number, default: 0 },
  cadenasCustodia: [String],
  procesosAplicados: [String],
  puntosRecuperacion: [{ _id: false, nombre: String, direccion: String, lat: Number, lng: Number }],
  observaciones: String,
  usuario: { type: ObjectId, ref: 'User' },
}, { timestamps: true });

reporteSchema.plugin(tenantPlugin);

export const ReporteEPR = mongoose.model('ReporteEPR', reporteSchema);
