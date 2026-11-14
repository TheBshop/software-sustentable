import mongoose from 'mongoose';
import { Router } from 'express';
import { z } from 'zod';
import { tenantPlugin } from '../../lib/tenancy.js';
import { dateInput } from '../../lib/validation.js';

// Seguridad e higiene del personal. La Ordenanza 9233 de Paraná (art. 21) exige que quien
// trabaja en contacto con residuos tenga elementos de protección y reciba capacitación.
// Este registro sirve de constancia ante una inspección y avisa a quién le falta algo.

export const TIPOS_REGISTRO = { epp: 'Entrega de elementos de protección', capacitacion: 'Capacitación' };
export const ELEMENTOS_EPP = ['guantes', 'botines', 'barbijo', 'antiparras', 'chaleco reflectivo', 'ropa de trabajo', 'protector auditivo', 'casco'];

/** Cada cuántos días hay que renovar la entrega de EPP o repetir la capacitación (alerta). */
export const VIGENCIA_DIAS = { epp: 180, capacitacion: 365 };

const registroSchema = new mongoose.Schema(
  {
    fecha: { type: Date, default: Date.now },
    tipo: { type: String, enum: Object.keys(TIPOS_REGISTRO), required: true },
    persona: { type: String, required: true, trim: true }, // socio/a o trabajador/a
    documento: { type: String, trim: true }, // DNI (opcional)
    elementos: [String], // solo EPP
    tema: String, // solo capacitación
    horas: Number,
    dictadaPor: String,
    observaciones: String,
  },
  { timestamps: true },
);
registroSchema.plugin(tenantPlugin);
registroSchema.index({ coop: 1, persona: 1, fecha: -1 });

export const RegistroSeguridad = mongoose.model('RegistroSeguridad', registroSchema);

export const registroInput = z
  .object({
    fecha: dateInput.optional(),
    tipo: z.enum(Object.keys(TIPOS_REGISTRO)),
    persona: z.string().min(2).max(120),
    documento: z.string().max(20).optional(),
    elementos: z.array(z.string().min(1).max(60)).max(20).optional(),
    tema: z.string().max(200).optional(),
    horas: z.number().positive().max(100).optional(),
    dictadaPor: z.string().max(120).optional(),
    observaciones: z.string().max(500).optional(),
  })
  .refine((r) => r.tipo !== 'epp' || r.elementos?.length, { message: 'Indicá qué elementos se entregaron', path: ['elementos'] })
  .refine((r) => r.tipo !== 'capacitacion' || r.tema, { message: 'Indicá el tema de la capacitación', path: ['tema'] });

// Una vez cargado solo se corrigen datos menores; si el registro está mal, se borra y se carga de nuevo.
export const registroUpdate = z.object({ documento: z.string().max(20).optional(), observaciones: z.string().max(500).optional(), dictadaPor: z.string().max(120).optional() });

/** Estado por persona: última entrega de EPP, última capacitación y qué está vencido. */
export const seguridadResumenRouter = Router();
seguridadResumenRouter.get('/resumen', async (_req, res) => {
  const registros = await RegistroSeguridad.find().sort('-fecha').limit(2000);
  const hoy = Date.now();
  const personas = new Map();
  for (const r of registros) {
    const p = personas.get(r.persona) ?? { persona: r.persona, epp: null, capacitacion: null };
    if (!p[r.tipo]) p[r.tipo] = { fecha: r.fecha, detalle: r.tipo === 'epp' ? r.elementos.join(', ') : r.tema };
    personas.set(r.persona, p);
  }
  const vencido = (reg, tipo) => !reg || hoy - new Date(reg.fecha).getTime() > VIGENCIA_DIAS[tipo] * 86_400_000;
  const items = [...personas.values()]
    .map((p) => ({ ...p, eppVencido: vencido(p.epp, 'epp'), capacitacionVencida: vencido(p.capacitacion, 'capacitacion') }))
    .sort((a, b) => a.persona.localeCompare(b.persona));
  res.json({
    vigenciaDias: VIGENCIA_DIAS,
    items,
    pendientes: items.filter((p) => p.eppVencido || p.capacitacionVencida).length,
  });
});
