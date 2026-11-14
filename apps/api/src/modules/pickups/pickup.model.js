import mongoose from 'mongoose';
import { tenantPlugin } from '../../lib/tenancy.js';

const { ObjectId } = mongoose.Schema.Types;

export const ESTADOS_RETIRO = ['registrado', 'en_planta', 'anulado'];

// Documentos que respaldan el traslado: se adjuntan al retiro para que los kilos se puedan
// contrastar con el papel ante una auditoría o inspección.
export const TIPOS_DOCUMENTO = { remito: 'Remito', ticket_pesaje: 'Ticket de pesaje', factura: 'Factura', manifiesto: 'Manifiesto de transporte', otro: 'Otro' };

const itemSchema = new mongoose.Schema(
  {
    material: { type: ObjectId, ref: 'Material', required: true },
    pesoEstimadoKg: { type: Number, required: true, min: 0 }, // lo carga el chofer en el momento
    pesoRealKg: { type: Number, min: 0 }, // lo completa la planta al pesar en balanza
    // Sin balanza: se cargan unidades (ej. 3 fardos) y el peso se estima con el peso estándar
    cantidad: Number,
    unidad: String,
  },
  { _id: false },
);

const pickupSchema = new mongoose.Schema(
  {
    numero: Number, // correlativo por cooperativa
    // UUID generado por la app móvil al crear el retiro offline. Si la app reintenta la
    // sincronización, el backend reconoce el localId y no duplica el retiro.
    localId: { type: String, unique: true, sparse: true },
    cliente: { type: ObjectId, ref: 'Client', required: true },
    direccion: String,
    fecha: { type: Date, default: Date.now },
    chofer: { type: ObjectId, ref: 'User' },
    items: {
      type: [itemSchema],
      validate: { validator: (v) => v.length > 0, message: 'El retiro debe tener al menos un material' },
    },
    fotos: [{ _id: false, url: String, subidaEn: { type: Date, default: Date.now } }],
    documentos: [
      {
        tipo: { type: String, enum: Object.keys(TIPOS_DOCUMENTO), required: true },
        nombre: String, // nombre del archivo original
        numero: String, // n° de remito, ticket o factura
        url: { type: String, required: true },
        mimetype: String,
        subidoPor: { type: ObjectId, ref: 'User' },
        subidoEn: { type: Date, default: Date.now },
      },
    ],
    ubicacion: { lat: Number, lng: Number },
    observaciones: String,
    estado: { type: String, enum: ESTADOS_RETIRO, default: 'registrado' },
    certificado: { type: ObjectId, ref: 'Certificate', default: null },
    factura: { type: ObjectId, ref: 'Invoice', default: null },
  },
  { timestamps: true },
);

pickupSchema.index({ cliente: 1, fecha: -1 });

/** Peso a usar en certificados, facturas y métricas: el real si ya se pesó, si no el estimado. */
export const pesoEfectivo = (item) => item.pesoRealKg ?? item.pesoEstimadoKg;

pickupSchema.plugin(tenantPlugin);
pickupSchema.index({ coop: 1, numero: 1 }, { unique: true });

export const Pickup = mongoose.model('Pickup', pickupSchema);
