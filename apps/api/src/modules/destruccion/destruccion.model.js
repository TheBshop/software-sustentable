import mongoose from 'mongoose';
import { tenantPlugin } from '../../lib/tenancy.js';

const { ObjectId } = mongoose.Schema.Types;

export const METODOS_DESTRUCCION = [
  'borrado_seguro',       // sobreescritura (NIST 800-88 Clear)
  'desmagnetizacion',     // degaussing
  'destruccion_fisica',   // trituración / perforación
  'borrado_criptografico', // crypto-erase (SSD/NVMe)
];

export const TIPOS_DISPOSITIVO = [
  'disco_rigido', 'ssd', 'pendrive', 'cinta_magnetica',
  'telefono', 'tablet', 'notebook', 'servidor', 'otro',
];

const dispositivoSchema = new mongoose.Schema({
  tipo: { type: String, enum: TIPOS_DISPOSITIVO, required: true },
  marca: String,
  modelo: String,
  numeroSerie: { type: String, required: true },
  capacidad: String,
  metodo: { type: String, enum: METODOS_DESTRUCCION, required: true },
  notas: String,
}, { _id: false });

const destruccionSchema = new mongoose.Schema({
  codigo: { type: String, required: true, unique: true },
  numero: Number,
  cliente: { type: ObjectId, ref: 'Client' },
  clienteNombre: String,
  clienteCuit: String,
  dispositivos: { type: [dispositivoSchema], required: true },
  fechaDestruccion: { type: Date, required: true },
  responsable: String,
  observaciones: String,
  fotoEvidencia: String,
  usuario: { type: ObjectId, ref: 'User' },
}, { timestamps: true });

destruccionSchema.plugin(tenantPlugin);

export const Destruccion = mongoose.model('Destruccion', destruccionSchema);
