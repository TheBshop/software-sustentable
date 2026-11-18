import mongoose from 'mongoose';
import { tenantPlugin } from '../../lib/tenancy.js';
import { z } from 'zod';
import { objectId, dateInput, round2 } from '../../lib/validation.js';

const { ObjectId } = mongoose.Schema.Types;

// ---------- Ingreso a planta ----------
// Registra lo que efectivamente entra a la planta (de un retiro propio o de otro origen,
// p. ej. recuperadores independientes o entregas voluntarias).
const intakeSchema = new mongoose.Schema(
  {
    fecha: { type: Date, default: Date.now },
    origen: { type: String, enum: ['retiro', 'recoleccion_municipal', 'recuperador', 'entrega_voluntaria', 'otro'], default: 'retiro' },
    retiro: { type: ObjectId, ref: 'Pickup' },
    detalleOrigen: String,
    items: [{ _id: false, material: { type: ObjectId, ref: 'Material', required: true }, pesoKg: { type: Number, required: true, min: 0 }, cantidad: Number, unidad: String, estimado: Boolean }],
    observaciones: String,
  },
  { timestamps: true },
);
intakeSchema.index({ fecha: -1 });
intakeSchema.plugin(tenantPlugin);
export const Intake = mongoose.model('Intake', intakeSchema);

export const intakeInput = z.object({
  fecha: dateInput.optional(),
  // Los ingresos de retiros propios los crea el sistema al pesar el retiro (movimiento.service.js)
  origen: z.enum(['recoleccion_municipal', 'recuperador', 'entrega_voluntaria', 'otro']).default('recuperador'),
  detalleOrigen: z.string().optional(),
  items: z
    .array(
      z
        .object({ material: objectId, pesoKg: z.number().min(0).optional(), cantidad: z.number().positive().optional(), unidad: z.string().max(30).optional() })
        .refine((i) => i.pesoKg != null || (i.cantidad != null && i.unidad), 'Indicá los kg o la cantidad y la unidad'),
    )
    .min(1),
  observaciones: z.string().optional(),
});

// ---------- Venta de material ----------
const saleSchema = new mongoose.Schema(
  {
    fecha: { type: Date, default: Date.now },
    comprador: { type: ObjectId, ref: 'Client', required: true },
    remito: String,
    items: [
      {
        _id: false,
        material: { type: ObjectId, ref: 'Material', required: true },
        pesoKg: { type: Number, required: true, min: 0 },
        precioKg: { type: Number, required: true, min: 0 },
        referenciaMinKg: Number, // precio de mercado al momento de la venta
        referenciaMaxKg: Number,
      },
    ],
    total: Number,
    cobrada: { type: Boolean, default: false },
  },
  { timestamps: true },
);
saleSchema.pre('save', function () {
  this.total = round2(this.items.reduce((acc, i) => acc + i.pesoKg * i.precioKg, 0));
});
saleSchema.index({ fecha: -1 });
saleSchema.plugin(tenantPlugin);
export const Sale = mongoose.model('Sale', saleSchema);

// Ingresos y ventas alimentan el libro de movimientos: después del alta solo se editan
// datos que no cambian el stock.
export const intakeUpdate = z.object({ observaciones: z.string().optional(), detalleOrigen: z.string().optional() });
export const saleUpdate = z.object({ cobrada: z.boolean().optional(), remito: z.string().optional() });

export const saleInput = z.object({
  fecha: dateInput.optional(),
  comprador: objectId,
  remito: z.string().optional(),
  items: z.array(z.object({ material: objectId, pesoKg: z.number().min(0), precioKg: z.number().min(0) })).min(1),
  cobrada: z.boolean().optional(),
});
