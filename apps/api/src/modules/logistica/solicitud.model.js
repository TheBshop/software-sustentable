import mongoose from 'mongoose';
import { z } from 'zod';
import { tenantPlugin } from '../../lib/tenancy.js';
import { objectId, dateInput } from '../../lib/validation.js';

const { ObjectId } = mongoose.Schema.Types;

// Pedido de retiro: lo hace el cliente desde su portal (o la cooperativa por él), se programa
// para un día y un chofer, y termina en un retiro registrado o en una visita fallida con motivo.
export const ESTADOS_SOLICITUD = ['pendiente', 'programada', 'realizada', 'no_realizada', 'rechazada', 'cancelada'];
export const MOTIVOS_NO_REALIZADO = {
  cerrado: 'Estaba cerrado / no atendieron',
  sin_material: 'No había material',
  material_mezclado: 'Material mezclado con basura',
  acceso_bloqueado: 'Acceso bloqueado',
  falta_tiempo: 'No se llegó en el día',
  otro: 'Otro',
};

const solicitudSchema = new mongoose.Schema(
  {
    cliente: { type: ObjectId, ref: 'Client', required: true },
    sede: String, // dirección de retiro
    detalle: String, // qué hay para retirar ("10 bolsones de cartón")
    kgEstimados: Number,
    fechaPreferida: Date,
    origen: { type: String, enum: ['portal', 'cooperativa', 'sugerencia'], default: 'cooperativa' },
    pedidaPor: { type: ObjectId, ref: 'User' },
    estado: { type: String, enum: ESTADOS_SOLICITUD, default: 'pendiente' },
    fechaProgramada: Date,
    chofer: { type: ObjectId, ref: 'User' },
    motivoRechazo: String,
    retiro: { type: ObjectId, ref: 'Pickup' },
    // Visita en la que no se pudo retirar: motivo, detalle y foto que respaldan el aviso al cliente
    resultado: { motivo: { type: String, enum: Object.keys(MOTIVOS_NO_REALIZADO) }, detalle: String, fotoUrl: String, fecha: Date, chofer: { type: ObjectId, ref: 'User' } },
  },
  { timestamps: true },
);
solicitudSchema.plugin(tenantPlugin);
solicitudSchema.index({ coop: 1, estado: 1, fechaProgramada: 1 });
export const Solicitud = mongoose.model('Solicitud', solicitudSchema);

export const solicitudInput = z.object({
  cliente: objectId,
  sede: z.string().max(200).optional(),
  detalle: z.string().max(500).optional(),
  kgEstimados: z.number().min(0).max(100000).optional(),
  fechaPreferida: dateInput.optional(),
  fechaProgramada: dateInput.optional(),
  chofer: objectId.optional(),
  origen: z.enum(['cooperativa', 'sugerencia']).optional(),
});

export const programarInput = z.object({
  fechaProgramada: dateInput.nullable().optional(),
  chofer: objectId.nullable().optional(),
  estado: z.enum(['pendiente', 'rechazada', 'cancelada']).optional(),
  motivoRechazo: z.string().max(300).optional(),
});
