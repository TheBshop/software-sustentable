// Comprobante electrónico AFIP emitido para una venta/factura de la organización.
// Modelo autónomo: no modifica Invoice. Un Invoice puede o no tener un ComprobanteAfip
// asociado (vincula por `invoice`). Los campos siguen la nomenclatura del WSFE.
// RG 4.892/2020: los datos imprescindibles van en el QR de AFIP (ver afip-qr.js).
import mongoose from 'mongoose';
import { tenantPlugin } from '../../lib/tenancy.js';

const { ObjectId } = mongoose.Schema.Types;

// Tipos de comprobante AFIP (los más usados). Códigos oficiales.
export const TIPOS_CBTE = {
  1: 'Factura A',
  6: 'Factura B',
  11: 'Factura C',
  19: 'Factura E', // exportación
  3: 'Nota de Crédito A',
  8: 'Nota de Crédito B',
  13: 'Nota de Crédito C',
  21: 'Nota de Crédito E',
  2: 'Nota de Débito A',
  7: 'Nota de Débito B',
  12: 'Nota de Débito C',
  20: 'Nota de Débito E',
};

export const CONCEPTOS = { 1: 'Productos', 2: 'Servicios', 3: 'Productos y Servicios' };
export const MONEDAS = { PES: 'Pesos', DOL: 'Dólares' };

// Condiciones de IVA del receptor (CondicionIVAReceptorId, usado desde 2024).
export const COND_IVA_RECEPTOR = {
  1: 'IVA Responsable Inscripto',
  4: 'IVA Sujeto Exento',
  5: 'Consumidor Final',
  6: 'Responsable Monotributo',
  7: 'Sujeto no Categorizado',
  8: 'Proveedor del Exterior',
  9: 'Cliente del Exterior',
  10: 'IVA Liberado - Ley 19.640',
  13: 'Monotributista Social',
  15: 'IVA no Alcanzado',
  16: 'Monotributo Trabajador Independiente Promovido',
};

export const DOC_TIPOS = { 80: 'CUIT', 86: 'CUIL', 87: 'CDI', 96: 'DNI', 99: 'Consumidor Final' };

const comprobanteSchema = new mongoose.Schema(
  {
    // Vínculo con el Invoice interno (opcional: el usuario puede emitir un comprobante suelto)
    invoice: { type: ObjectId, ref: 'Invoice' },

    // Datos del comprobante
    tipo: { type: Number, enum: Object.keys(TIPOS_CBTE).map(Number), required: true }, // 11 = Factura C
    ptoVta: { type: Number, required: true, min: 1, max: 99999 },
    numero: { type: Number, required: true, min: 1 }, // N° correlativo por (coop, ptoVta, tipo)
    fecha: { type: Date, required: true },
    concepto: { type: Number, enum: [1, 2, 3], default: 1 },

    // Receptor
    docTipo: { type: Number, enum: Object.keys(DOC_TIPOS).map(Number), default: 99 },
    docNro: { type: String, trim: true, default: '0' },
    condIvaReceptor: { type: Number, enum: Object.keys(COND_IVA_RECEPTOR).map(Number), default: 5 },
    receptorNombre: { type: String, trim: true },

    // Importes
    moneda: { type: String, enum: Object.keys(MONEDAS), default: 'PES' },
    cotizacion: { type: Number, default: 1 },
    importeNeto: { type: Number, required: true, min: 0 },
    importeIva: { type: Number, default: 0, min: 0 },
    importeExento: { type: Number, default: 0, min: 0 },
    importeNoGravado: { type: Number, default: 0, min: 0 },
    importeTributos: { type: Number, default: 0, min: 0 },
    importeTotal: { type: Number, required: true, min: 0 },

    // Desglose de IVA (tasa → monto base + monto IVA)
    iva: [{ _id: false, tasa: Number, baseImp: Number, importe: Number }],

    // Respuesta AFIP
    cae: { type: String, trim: true },
    caeVence: Date,
    resultado: { type: String, enum: ['A', 'R', 'P', 'simulado'], default: 'simulado' }, // A=aprobado, R=rechazado, P=parcial
    observaciones: [{ _id: false, codigo: Number, msg: String }],
    errores: [{ _id: false, codigo: Number, msg: String }],

    // Entorno y origen
    entorno: { type: String, enum: ['homologacion', 'produccion'], default: 'homologacion' },
    modo: { type: String, enum: ['afip', 'mock'], default: 'mock' }, // 'mock' hasta que haya certificado real

    // Anulación lógica (AFIP no permite anular, solo emitir Nota de Crédito; dejamos la marca)
    anulado: { type: Boolean, default: false },
    notaCreditoId: { type: ObjectId, ref: 'ComprobanteAfip' },
  },
  { timestamps: true },
);
comprobanteSchema.plugin(tenantPlugin);
comprobanteSchema.index({ coop: 1, tipo: 1, ptoVta: 1, numero: 1 }, { unique: true });
comprobanteSchema.index({ coop: 1, fecha: -1 });
export const ComprobanteAfip = mongoose.model('ComprobanteAfip', comprobanteSchema);

export const fmtComprobante = (c) => `${String(c.tipo).padStart(2, '0')}-${String(c.ptoVta).padStart(5, '0')}-${String(c.numero).padStart(8, '0')}`;
