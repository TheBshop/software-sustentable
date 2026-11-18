// Manifiesto de traslado de residuos (Ley 25.612 art. 21 + normativa provincial).
// Flujo: EMITIDO → EN_TRANSITO → RECIBIDO. El destinatario firma en una página
// pública (QR del PDF), con GPS + hora. Un manifiesto anulado conserva la trazabilidad.
import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';
import { tenantPlugin } from '../../lib/tenancy.js';
import { CORRIENTES } from '../organizations/organization.model.js';

const { ObjectId } = mongoose.Schema.Types;

export const ESTADOS = ['emitido', 'en_transito', 'recibido', 'anulado'];

const parteSchema = new mongoose.Schema({ razonSocial: String, cuit: String, direccion: String, lat: Number, lng: Number }, { _id: false });
const transporteSchema = new mongoose.Schema({ razonSocial: String, cuit: String, patente: String, chofer: String, habilitacion: String }, { _id: false });
const itemSchema = new mongoose.Schema({ material: { type: ObjectId, ref: 'Material', required: true }, kg: { type: Number, required: true, min: 0 }, unidades: Number }, { _id: false });
const recepcionSchema = new mongoose.Schema({ fecha: Date, firmaBase64: String, firmanteNombre: String, firmanteDni: String, lat: Number, lng: Number, observaciones: String, ip: String }, { _id: false });

const manifiestoSchema = new mongoose.Schema(
  {
    numero: { type: Number, required: true },
    codigo: { type: String, required: true, unique: true, sparse: true }, // random 16 chars para QR público
    fecha: { type: Date, default: Date.now },
    remito: { type: ObjectId, ref: 'Remito' },
    origen: parteSchema,
    destino: parteSchema,
    transporte: transporteSchema,
    items: [itemSchema],
    corriente: { type: String, enum: CORRIENTES },
    estado: { type: String, enum: ESTADOS, default: 'emitido' },
    recepcion: recepcionSchema,
    motivoAnulacion: String,
  },
  { timestamps: true },
);
manifiestoSchema.plugin(tenantPlugin);
manifiestoSchema.index({ coop: 1, numero: 1 }, { unique: true });
export const Manifiesto = mongoose.model('Manifiesto', manifiestoSchema);

export const fmtManifiesto = (m) => `M-${String(m.numero).padStart(6, '0')}`;
export const generarCodigo = () => randomBytes(8).toString('hex').toUpperCase();
