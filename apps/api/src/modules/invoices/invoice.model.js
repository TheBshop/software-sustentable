import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

// IMPORTANTE: esto es una "liquidación / prefactura" interna. La factura electrónica con
// validez fiscal (CAE de ARCA, ex AFIP) se emite por un proveedor externo y se guarda en
// `comprobanteFiscal`. Ver docs/01-stack-y-arquitectura.md → "Facturación".
const invoiceSchema = new mongoose.Schema(
  {
    numero: { type: Number, unique: true },
    cliente: { type: ObjectId, ref: 'Client', required: true },
    clienteSnapshot: { razonSocial: String, cuit: String, condicionIva: String },
    periodo: { desde: Date, hasta: Date },
    retiros: [{ type: ObjectId, ref: 'Pickup' }],
    lineas: [{ _id: false, descripcion: String, cantidad: Number, unidad: String, precioUnitario: Number, subtotal: Number }],
    total: { type: Number, required: true },
    emitidaEn: { type: Date, default: Date.now },
    vencimiento: { type: Date, required: true },
    estado: { type: String, enum: ['pendiente', 'pagada', 'anulada'], default: 'pendiente' },
    pagos: [{ _id: false, fecha: { type: Date, default: Date.now }, monto: Number, medio: String, referencia: String }],
    comprobanteFiscal: { tipo: String, puntoVenta: Number, numero: Number, cae: String, caeVencimiento: Date },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

invoiceSchema.virtual('pagado').get(function () {
  return this.pagos.reduce((a, p) => a + p.monto, 0);
});
invoiceSchema.virtual('saldo').get(function () {
  return Math.round((this.total - this.pagado) * 100) / 100;
});
invoiceSchema.virtual('vencida').get(function () {
  return this.estado === 'pendiente' && this.vencimiento < new Date();
});

invoiceSchema.index({ estado: 1, vencimiento: 1 });
invoiceSchema.index({ cliente: 1, emitidaEn: -1 });

export const Invoice = mongoose.model('Invoice', invoiceSchema);
