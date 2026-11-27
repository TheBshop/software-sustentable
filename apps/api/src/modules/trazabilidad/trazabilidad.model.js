import mongoose from 'mongoose';
import { tenantPlugin } from '../../lib/tenancy.js';

const { ObjectId } = mongoose.Schema.Types;

// ---- Evento de auditoría (inmutable) ----
// Cada paso de la cadena de custodia se registra como un evento que no se puede modificar.

const ETAPAS = ['generacion', 'recoleccion', 'transporte', 'recepcion', 'clasificacion', 'transformacion', 'producto_final', 'entrega'];

const eventoSchema = new mongoose.Schema({
  etapa: { type: String, enum: ETAPAS, required: true },
  fecha: { type: Date, default: Date.now },
  responsable: { type: ObjectId, ref: 'User' },
  responsableNombre: String,
  ubicacion: { direccion: String, ciudad: String, lat: Number, lng: Number },
  observaciones: String,
  evidencia: String, // URL de foto o documento adjunto
}, { _id: true, timestamps: false });

// ---- Lote de material (cada flujo de residuo trazado) ----

const loteSchema = new mongoose.Schema({
  tipo: { type: String, required: true },
  pesoKg: { type: Number, required: true },
  unidad: { type: String, default: 'kg' },

  // Identificación del residuo (inspirado en código LER)
  descripcion: String,
  estadoFisico: { type: String, enum: ['solido', 'liquido', 'pastoso', 'gaseoso'], default: 'solido' },
  peligroso: { type: Boolean, default: false },
  caracteristicasPeligrosidad: String,

  // Origen / generador
  origenTipo: { type: String, enum: ['recoleccion_domiciliaria', 'punto_verde', 'gran_generador', 'recolector_urbano', 'otro'], default: 'recoleccion_domiciliaria' },
  origenDetalle: String,
  generador: { nombre: String, cuit: String, direccion: String, ciudad: String },

  // Transporte
  transportista: { nombre: String, patente: String, habilitacion: String },
  fechaRecoleccion: { type: Date, default: Date.now },
  fechaRecepcion: Date,

  // Clasificación y tratamiento
  fechaClasificacion: Date,
  procesoTransformacion: String, // "enfardado", "triturado", "lavado", "fundido", etc.
  fechaTransformacion: Date,

  // Huella ambiental calculada
  co2EvitadoKg: Number,
  aguaEvitadaL: Number,

  // Cadena de custodia: eventos ordenados cronológicamente
  eventos: [eventoSchema],
}, { _id: true });

// ---- Producto reciclado ----

const productoSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  descripcion: String,
  categoria: { type: String, enum: ['ecoladrillo', 'maceta', 'bloque', 'compost', 'mobiliario', 'textil', 'otro'], default: 'otro' },

  lotes: [loteSchema],

  // Totales calculados
  pesoTotalKg: { type: Number, default: 0 },
  co2EvitadoKg: { type: Number, default: 0 },
  aguaEvitadaL: { type: Number, default: 0 },

  // Ciclo de vida del producto
  estado: { type: String, enum: ['en_produccion', 'disponible', 'entregado'], default: 'en_produccion' },
  foto: String,
  qrToken: { type: String, unique: true, sparse: true },

  // Entrega
  entregadoA: { type: ObjectId, ref: 'User' },
  entregadoANombre: String,
  fechaEntrega: Date,

  // Certificación
  certificadoPor: { type: ObjectId, ref: 'User' },
  certificadoPorNombre: String,
  fechaCertificacion: Date,

  // Auditoría general del producto
  eventos: [eventoSchema],
}, { timestamps: true });

productoSchema.plugin(tenantPlugin);

productoSchema.index({ qrToken: 1 });
productoSchema.index({ estado: 1 });
productoSchema.index({ createdAt: -1 });

export const ProductoReciclado = mongoose.model('ProductoReciclado', productoSchema);
export { ETAPAS };
