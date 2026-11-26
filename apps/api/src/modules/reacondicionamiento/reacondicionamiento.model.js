import mongoose from 'mongoose';
import { tenantPlugin } from '../../lib/tenancy.js';

const { ObjectId } = mongoose.Schema.Types;

export const TIPOS_EQUIPO = [
  'notebook', 'desktop', 'monitor', 'impresora', 'telefono', 'tablet',
  'servidor', 'switch_red', 'router', 'ups', 'otro',
];

export const ESTADOS_EQUIPO = [
  'ingreso',        // recibido, sin evaluar
  'diagnostico',    // en evaluación técnica
  'reparacion',     // en reparación / reacondicionamiento
  'testing',        // pruebas finales
  'listo',          // listo para venta / donación
  'vendido',        // salió al mercado circular
  'descarte',       // no se puede reacondicionar → RAEE
];

const intervencionSchema = new mongoose.Schema({
  fecha: { type: Date, default: Date.now },
  tipo: { type: String, required: true }, // diagnostico, reparacion, limpieza, cambio_pieza, testing, etc.
  descripcion: String,
  piezas: String,
  costo: Number,
  tecnico: String,
}, { _id: true });

const equipoSchema = new mongoose.Schema({
  tipo: { type: String, enum: TIPOS_EQUIPO, required: true },
  marca: String,
  modelo: String,
  numeroSerie: { type: String, required: true },
  estado: { type: String, enum: ESTADOS_EQUIPO, default: 'ingreso' },
  // Origen
  origenNombre: String,
  origenCuit: String,
  fechaIngreso: { type: Date, default: Date.now },
  // Specs
  procesador: String,
  ram: String,
  almacenamiento: String,
  pantalla: String,
  sistemaOperativo: String,
  otrasSpecs: String,
  // Historial
  intervenciones: [intervencionSchema],
  diagnosticoInicial: String,
  costoTotal: { type: Number, default: 0 },
  // Resultado
  precioVenta: Number,
  destinoFinal: String, // nombre del comprador/donatario
  fechaSalida: Date,
  // Fotos
  fotos: [String],
  notas: String,
  usuario: { type: ObjectId, ref: 'User' },
}, { timestamps: true });

equipoSchema.plugin(tenantPlugin);

export const Equipo = mongoose.model('Equipo', equipoSchema);
