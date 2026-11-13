import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

// El certificado guarda un SNAPSHOT de los datos: si mañana cambia el factor de CO2 de un
// material o la razón social del cliente, los certificados ya emitidos no se alteran.
const certificateSchema = new mongoose.Schema(
  {
    codigo: { type: String, required: true, unique: true }, // va en el QR; no adivinable
    numero: { type: Number, unique: true },
    retiro: { type: ObjectId, ref: 'Pickup', required: true, unique: true },
    cliente: { type: ObjectId, ref: 'Client', required: true },
    clienteSnapshot: { razonSocial: String, cuit: String },
    fechaRetiro: Date,
    materiales: [
      {
        _id: false,
        material: { type: ObjectId, ref: 'Material' },
        nombre: String,
        pesoKg: Number,
        pesoEstimado: Boolean, // true si todavía no se había pesado en planta
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

export const Certificate = mongoose.model('Certificate', certificateSchema);
