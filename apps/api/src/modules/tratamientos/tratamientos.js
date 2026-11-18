// Tratamientos por corriente (compostaje, reciclado de plásticos, RAEE, áridos…): cada partida
// con lo que entró, lo que salió por producto, el rechazo y los parámetros de control del
// catálogo CORR (con su rango aceptable). Las corrientes son las elegidas en la configuración.
import mongoose from 'mongoose';
import { Router } from 'express';
import { z } from 'zod';
import { CORR, GRUPOS } from '@nueva-vida/catalogos';
import { tenantPlugin, currentTenant } from '../../lib/tenancy.js';
import { Organization } from '../organizations/organization.model.js';
import { dateInput, parseLocalDate, round2 } from '../../lib/validation.js';
import { requireRole } from '../../middleware/auth.js';
import { HttpError } from '../../middleware/error.js';

const partidaSchema = new mongoose.Schema(
  {
    corriente: { type: String, required: true, enum: Object.keys(CORR) },
    fecha: { type: Date, required: true },
    lote: String,
    entrada: { type: Number, required: true, min: 0 },
    salidas: { type: Map, of: Number, default: {} },
    rechazo: { type: Number, min: 0 },
    params: { type: Map, of: Number, default: {} },
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
partidaSchema.plugin(tenantPlugin);
partidaSchema.index({ coop: 1, corriente: 1, fecha: -1 });
export const PartidaTratamiento = mongoose.model('PartidaTratamiento', partidaSchema);

/** El parámetro está fuera del rango aceptable del catálogo. */
export const fueraDeRango = (v, min, max) => v != null && ((min != null && v < min) || (max != null && v > max));

const rangoMes = (mes) => {
  const desde = parseLocalDate(`${mes}-01`);
  const hasta = new Date(desde);
  hasta.setMonth(hasta.getMonth() + 1);
  return { $gte: desde, $lt: hasta };
};
const mesActual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/** Indicadores del mes de una corriente: entrada, salidas por producto, rendimiento, rechazo, sin registrar y fuera de rango. */
export function indicadores(c, partidas) {
  const entrada = partidas.reduce((a, p) => a + p.entrada, 0);
  const porProducto = Object.fromEntries(c.prod.map((pr) => [pr, round2(partidas.reduce((a, p) => a + (p.salidas?.[pr] ?? 0), 0))]));
  const salidas = Object.values(porProducto).reduce((a, v) => a + v, 0);
  const rechazo = partidas.reduce((a, p) => a + (p.rechazo ?? 0), 0);
  const fuera = partidas.filter((p) => c.params.some(([k, , , mn, mx]) => fueraDeRango(p.params?.[k], mn, mx))).length;
  return {
    partidas: partidas.length,
    entrada: round2(entrada),
    salidas: round2(salidas),
    porProducto,
    rechazo: round2(rechazo),
    rendimiento: entrada ? round2((salidas / entrada) * 100) : null,
    sinRegistrar: entrada ? round2(entrada - salidas - rechazo) : null,
    fueraDeRango: fuera,
  };
}

const plano = (p) => ({ ...p, salidas: Object.fromEntries(p.salidas instanceof Map ? p.salidas : Object.entries(p.salidas ?? {})), params: Object.fromEntries(p.params instanceof Map ? p.params : Object.entries(p.params ?? {})) });

export const tratamientosRouter = Router();

/** Corrientes de la organización con su definición, las etapas que hace y los indicadores del mes. */
tratamientosRouter.get('/', async (req, res) => {
  const { mes = mesActual() } = z.object({ mes: z.string().regex(/^\d{4}-\d{2}$/).optional() }).parse(req.query);
  const org = await Organization.findById(currentTenant()).lean();
  const elegidas = (org.configuracion?.corrientes ?? []).filter((id) => CORR[id]);
  const partidas = (await PartidaTratamiento.find({ corriente: { $in: elegidas }, fecha: rangoMes(mes) }).lean()).map(plano);
  res.json({
    mes,
    grupos: GRUPOS,
    corrientes: elegidas.map((id) => ({
      id,
      ...CORR[id],
      etapasHechas: org.configuracion?.etapas?.[id] ?? [],
      indicadores: indicadores(CORR[id], partidas.filter((p) => p.corriente === id)),
    })),
  });
});

const corrienteElegida = async (id) => {
  if (!CORR[id]) throw new HttpError(404, `Corriente desconocida: ${id}`);
  return CORR[id];
};

tratamientosRouter.get('/:corriente', async (req, res) => {
  await corrienteElegida(req.params.corriente);
  const { mes = mesActual() } = z.object({ mes: z.string().regex(/^\d{4}-\d{2}$/).optional() }).parse(req.query);
  const items = (await PartidaTratamiento.find({ corriente: req.params.corriente, fecha: rangoMes(mes) }).sort({ fecha: -1 }).lean()).map(plano);
  res.json({ items });
});

const ESCRIBEN = requireRole('administracion', 'operador_planta');

tratamientosRouter.post('/:corriente', ESCRIBEN, async (req, res) => {
  const c = await corrienteElegida(req.params.corriente);
  const d = z
    .object({
      fecha: dateInput,
      lote: z.string().trim().max(60).optional(),
      entrada: z.number().min(0),
      salidas: z.record(z.enum(c.prod.length ? c.prod : ['_']), z.number().min(0)).optional(),
      rechazo: z.number().min(0).optional(),
      params: z.record(z.enum(c.params.length ? c.params.map(([k]) => k) : ['_']), z.number()).optional(),
    })
    .parse(req.body);
  const salidas = Object.values(d.salidas ?? {}).reduce((a, v) => a + v, 0) + (d.rechazo ?? 0);
  if (salidas > d.entrada * 1.05) throw new HttpError(422, `Lo que salió (${round2(salidas)}) supera lo que entró (${d.entrada})`);
  const p = await PartidaTratamiento.create({ ...d, corriente: req.params.corriente, usuario: req.user.sub });
  const fuera = c.params.filter(([k, , , mn, mx]) => fueraDeRango(d.params?.[k], mn, mx)).map(([, l]) => l);
  res.status(201).json({ ...plano(p.toObject()), avisos: fuera.map((l) => `${l} fuera del rango aceptable`) });
});

tratamientosRouter.delete('/:corriente/:id', ESCRIBEN, async (req, res) => {
  const r = await PartidaTratamiento.deleteOne({ _id: req.params.id, corriente: req.params.corriente });
  if (!r.deletedCount) throw new HttpError(404, 'No encontrada');
  res.status(204).end();
});

/** Etapas del proceso que hace la organización en esa corriente. */
tratamientosRouter.put('/:corriente/etapas', requireRole('administracion'), async (req, res) => {
  const c = await corrienteElegida(req.params.corriente);
  const etapas = z.array(z.number().int().min(0).max(c.etapas.length - 1)).parse(req.body.etapas);
  await Organization.updateOne({ _id: currentTenant() }, { $set: { [`configuracion.etapas.${req.params.corriente}`]: [...new Set(etapas)].sort() } });
  res.json({ etapas });
});
