import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

export const ESTADOS_RETIRO = ['registrado', 'en_planta', 'anulado'];

const itemSchema = new mongoose.Schema(
  {
    material: { type: ObjectId, ref: 'Material', required: true },
    pesoEstimadoKg: { type: Number, required: true, min: 0 }, // lo carga el chofer en el momento
    pesoRealKg: { type: Number, min: 0 }, // lo completa la planta al pesar en balanza
  },
  { _id: false },
);

const pickupSchema = new mongoose.Schema(
  {
    numero: { type: Number, unique: true },
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

export const Pickup = mongoose.model('Pickup', pickupSchema);
