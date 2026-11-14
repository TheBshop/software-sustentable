import mongoose from 'mongoose';
import { tenantPlugin } from '../../lib/tenancy.js';

const { ObjectId } = mongoose.Schema.Types;

// El certificado guarda un SNAPSHOT de los datos: si mañana cambia el factor de CO2 de un
// material o la razón social del cliente, los certificados ya emitidos no se alteran.
const certificateSchema = new mongoose.Schema(
  {
    codigo: { type: String, required: true, unique: true }, // va en el QR; no adivinable
    numero: Number, // correlativo por cooperativa
    retiro: { type: ObjectId, ref: 'Pickup', required: true, unique: true },
    cliente: { type: ObjectId, ref: 'Client', required: true },
    clienteSnapshot: { razonSocial: String, cuit: String },
    emisorSnapshot: { nombre: String, cuit: String }, // la cooperativa que certifica
    fechaRetiro: Date,
    materiales: [
      {
        _id: false,
        material: { type: ObjectId, ref: 'Material' },
        nombre: String,
        pesoKg: Number,
        pesoEstimado: Boolean, // true si todavía no se había pesado en planta
        corriente: String, // rsu, regu… (docs/08-marco-normativo.md)
        fraccion: String, // Decreto 779/22, Anexo II
        valorizable: Boolean, // false = disposición final
        co2EvitadoKg: Number,
      },
    ],
    totalKg: Number,
    co2EvitadoKg: Number,
    envios: [{ _id: false, canal: { type: String, enum: ['email', 'whatsapp'] }, destino: String, fecha: { type: Date, default: Date.now } }],
    anulado: { type: Boolean, default: false },
  },
  { timestamps: true },
);

certificateSchema.plugin(tenantPlugin);
certificateSchema.index({ coop: 1, numero: 1 }, { unique: true });

export const Certificate = mongoose.model('Certificate', certificateSchema);
