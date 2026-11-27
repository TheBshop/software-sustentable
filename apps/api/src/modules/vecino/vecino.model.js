import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const itemSchema = new mongoose.Schema({
  tipo: String,
  material: String,
  reciclable: Boolean,
  peligroso: Boolean,
  cantidad_estimada: String,
  pesoEstimadoKg: Number,
  guia: { contenedor: String, instruccion: String },
}, { _id: false });

const identificacionSchema = new mongoose.Schema({
  usuario: { type: ObjectId, ref: 'User', required: true, index: true },
  items: [itemSchema],
  observaciones: String,
  recomendacion: String,
  pesoEstimadoKg: { type: Number, default: 0 },
  co2EvitadoKg: { type: Number, default: 0 },
}, { timestamps: true });

export const IdentificacionVecino = mongoose.model('IdentificacionVecino', identificacionSchema);

const ESTADOS_RETIRO = ['pendiente', 'confirmado', 'retirado', 'cancelado'];

const retiroSchema = new mongoose.Schema({
  usuario: { type: ObjectId, ref: 'User', required: true, index: true },
  direccion: { type: String, required: true },
  ciudad: String,
  lat: Number,
  lng: Number,
  fechaPreferida: Date,
  franjaHoraria: { type: String, enum: ['manana', 'tarde', 'todo_el_dia'], default: 'todo_el_dia' },
  materiales: [String],
  observaciones: String,
  estado: { type: String, enum: ESTADOS_RETIRO, default: 'pendiente' },
  pesoEstimadoKg: Number,
}, { timestamps: true });

export const RetiroVecino = mongoose.model('RetiroVecino', retiroSchema);

const perfilSchema = new mongoose.Schema({
  usuario: { type: ObjectId, ref: 'User', required: true, unique: true },
  telefono: String,
  dni: String,
  direccion: String,
  ciudad: String,
  provincia: String,
  lat: Number,
  lng: Number,
  fechaNacimiento: Date,
}, { timestamps: true });

export const PerfilVecino = mongoose.model('PerfilVecino', perfilSchema);
