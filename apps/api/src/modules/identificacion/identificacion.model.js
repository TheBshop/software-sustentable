import mongoose from 'mongoose';
import { tenantPlugin, currentTenant } from '../../lib/tenancy.js';

const itemSchema = new mongoose.Schema({
  tipo: String,
  material: String,
  reciclable: Boolean,
  peligroso: Boolean,
  corriente: String,
  cantidad_estimada: String,
  estado: String,
}, { _id: false });

const schema = new mongoose.Schema({
  foto: { type: String, required: true },
  ubicacion: {
    lat: Number,
    lng: Number,
    precision: Number,
    direccion: String,
  },
  items: [itemSchema],
  observaciones: String,
  recomendacion: String,
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notas: String,
}, { timestamps: true });

schema.plugin(tenantPlugin);

export const Identificacion = mongoose.model('Identificacion', schema);
