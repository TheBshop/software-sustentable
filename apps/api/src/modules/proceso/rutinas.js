// Rutinas de planta: tareas por puesto (diarias, semanales, mensuales), responsables y registro
// de quién las hizo. Las tareas base salen del catálogo TAREAS_BASE; cada organización suma las suyas.
import mongoose from 'mongoose';
import { Router } from 'express';
import { z } from 'zod';
import { TAREAS_BASE, FREC } from '@nueva-vida/catalogos';
import { tenantPlugin, currentTenant } from '../../lib/tenancy.js';
import { Organization } from '../organizations/organization.model.js';
import { perfilDe } from '../registros/registro.model.js';
import { HttpError } from '../../middleware/error.js';
import { requireRole } from '../../middleware/auth.js';

const { ObjectId } = mongoose.Schema.Types;

export const PUESTOS = {
  cooperativa: { recepcion: 'Recepción', clasificacion: 'Clasificación (cinta)', proceso: 'Enfardado (prensa)', acopio: 'Acopio', venta: 'Venta y administración', seguridad: 'Seguridad e higiene' },
  empresa: { recepcion: 'Recepción y compra', clasificacion: 'Clasificación', proceso: 'Proceso (molienda, lavado)', acopio: 'Acopio', venta: 'Venta y administración', seguridad: 'Seguridad e higiene' },
};

const rutinaSchema = new mongoose.Schema({
  unica: { type: String, default: 'rutina' }, // una sola por organización (índice único)
  responsables: { type: Map, of: String, default: {} },
  extra: [{ _id: false, id: String, puesto: String, t: String, f: { type: String, enum: Object.keys(FREC) } }],
});
rutinaSchema.plugin(tenantPlugin);
rutinaSchema.index({ coop: 1, unica: 1 }, { unique: true });
export const Rutina = mongoose.model('Rutina', rutinaSchema);

const hechoSchema = new mongoose.Schema(
  { tarea: { type: String, required: true }, periodo: { type: String, required: true }, quien: String, usuario: { type: ObjectId, ref: 'User' } },
  { timestamps: true },
);
hechoSchema.plugin(tenantPlugin);
hechoSchema.index({ coop: 1, tarea: 1, periodo: 1 }, { unique: true });
export const TareaHecha = mongoose.model('TareaHecha', hechoSchema);

const pad = (n) => String(n).padStart(2, '0');
export const fechaLocal = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const lunes = (d = new Date()) => {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return fechaLocal(x);
};
/** Período en curso de una tarea: el día, la semana (desde el lunes) o el mes. */
export const periodo = (f, d = new Date()) => (f === 'd' ? fechaLocal(d) : f === 's' ? `S${lunes(d)}` : fechaLocal(d).slice(0, 7));

const rutinaDe = async () => (await Rutina.findOne()) ?? Rutina.create({});
export const tareasDe = (r) => [...TAREAS_BASE.map(([id, puesto, t, f]) => ({ id, puesto, t, f, base: true })), ...(r?.extra ?? []).map((x) => ({ ...x.toObject?.() ?? x }))];

/** Tareas pendientes del período en curso (para el panel y el mapa del proceso). */
export async function tareasPendientes(frecuencia) {
  const r = await Rutina.findOne();
  const tareas = tareasDe(r).filter((t) => !frecuencia || t.f === frecuencia);
  const hechas = new Set((await TareaHecha.find({ periodo: { $in: [...new Set(tareas.map((t) => periodo(t.f)))] } }).lean()).map((h) => `${h.tarea}|${h.periodo}`));
  return tareas.filter((t) => !hechas.has(`${t.id}|${periodo(t.f)}`));
}

export const rutinasRouter = Router();

rutinasRouter.get('/', async (_req, res) => {
  const org = await Organization.findById(currentTenant()).lean();
  const r = await rutinaDe();
  const tareas = tareasDe(r);
  const ult = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return fechaLocal(d);
  });
  const periodos = [...new Set([...tareas.map((t) => periodo(t.f)), ...ult])];
  const hechos = await TareaHecha.find({ periodo: { $in: periodos } }).lean();
  const h = Object.fromEntries(hechos.map((x) => [`${x.tarea}|${x.periodo}`, { quien: x.quien, hora: x.createdAt }]));
  res.json({
    puestos: PUESTOS[perfilDe(org)] ?? PUESTOS.cooperativa,
    frecuencias: FREC,
    responsables: Object.fromEntries(r.responsables ?? []),
    ultimosDias: ult,
    tareas: tareas.map((t) => ({ ...t, periodo: periodo(t.f), hecha: h[`${t.id}|${periodo(t.f)}`] ?? null, dias: t.f === 'd' ? ult.map((d) => Boolean(h[`${t.id}|${d}`])) : undefined })),
  });
});

const GESTIONA = requireRole('administracion', 'operador_planta');

rutinasRouter.put('/responsables', GESTIONA, async (req, res) => {
  const data = z.record(z.enum(Object.keys(PUESTOS.cooperativa)), z.string().trim().max(80)).parse(req.body);
  const r = await rutinaDe();
  for (const [k, v] of Object.entries(data)) r.responsables.set(k, v);
  await r.save();
  res.json({ responsables: Object.fromEntries(r.responsables) });
});

rutinasRouter.post('/tareas', GESTIONA, async (req, res) => {
  const d = z.object({ puesto: z.enum(Object.keys(PUESTOS.cooperativa)), t: z.string().trim().min(3).max(160), f: z.enum(Object.keys(FREC)) }).parse(req.body);
  const r = await rutinaDe();
  const tarea = { id: `x${Date.now().toString(36)}`, ...d };
  r.extra.push(tarea);
  await r.save();
  res.status(201).json(tarea);
});

rutinasRouter.delete('/tareas/:id', GESTIONA, async (req, res) => {
  const r = await rutinaDe();
  const antes = r.extra.length;
  r.extra = r.extra.filter((x) => x.id !== req.params.id);
  if (r.extra.length === antes) throw new HttpError(404, 'Solo se pueden quitar las tareas agregadas por la organización');
  await r.save();
  res.status(204).end();
});

/** Marca o desmarca una tarea en el período en curso. Cualquier usuario de la planta puede marcar. */
rutinasRouter.post('/hechas', async (req, res) => {
  const { tarea, hecha } = z.object({ tarea: z.string(), hecha: z.boolean() }).parse(req.body);
  const r = await rutinaDe();
  const t = tareasDe(r).find((x) => x.id === tarea);
  if (!t) throw new HttpError(404, 'Tarea inexistente');
  const p = periodo(t.f);
  if (hecha) await TareaHecha.updateOne({ tarea, periodo: p }, { $setOnInsert: { tarea, periodo: p, coop: currentTenant(), quien: r.responsables?.get(t.puesto) || req.user.nombre, usuario: req.user.sub } }, { upsert: true });
  else await TareaHecha.deleteOne({ tarea, periodo: p });
  res.json({ tarea, periodo: p, hecha });
});
