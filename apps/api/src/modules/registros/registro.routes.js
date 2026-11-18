// Registros por perfil: definiciones, carga, corrección y baja.
import { Router } from 'express';
import { z } from 'zod';
import { Organization } from '../organizations/organization.model.js';
import { currentTenant } from '../../lib/tenancy.js';
import { HttpError } from '../../middleware/error.js';
import { parseLocalDate } from '../../lib/validation.js';
import { RegistroServicio, definiciones, definicion, esquemaRegistro, perfilDe } from './registro.model.js';

export const registrosRouter = Router();

const perfilActual = async () => perfilDe(await Organization.findById(currentTenant()).lean());
const rangoMes = (mes) => {
  const desde = parseLocalDate(`${mes}-01`);
  const hasta = new Date(desde);
  hasta.setMonth(hasta.getMonth() + 1);
  return { $gte: desde, $lt: hasta };
};
const mesActual = () => new Date().toISOString().slice(0, 7);

/** Definiciones del perfil, con la cantidad de filas cargadas en el mes. */
registrosRouter.get('/', async (req, res) => {
  const { mes = mesActual() } = z.object({ mes: z.string().regex(/^\d{4}-\d{2}$/).optional() }).parse(req.query);
  const perfil = await perfilActual();
  const conteo = await RegistroServicio.aggregate([
    { $match: { $or: [{ fecha: rangoMes(mes) }, { fecha: null }] } },
    { $group: { _id: '$registro', n: { $sum: 1 } } },
  ]);
  const n = Object.fromEntries(conteo.map((c) => [c._id, c.n]));
  res.json({ perfil, mes, definiciones: definiciones(perfil).map((d) => ({ ...d, filasMes: n[d.id] ?? 0 })) });
});

async function defDe(id) {
  const def = definicion(await perfilActual(), id);
  if (!def) throw new HttpError(404, `Registro desconocido para este perfil: ${id}`);
  return def;
}

registrosRouter.get('/:registro', async (req, res) => {
  const def = await defDe(req.params.registro);
  const { mes } = z.object({ mes: z.string().regex(/^\d{4}-\d{2}$/).optional() }).parse(req.query);
  const filtro = { registro: def.id, ...(mes && !def.sinMes && { fecha: rangoMes(mes) }) };
  res.json({ items: await RegistroServicio.find(filtro).sort({ fecha: -1, createdAt: -1 }).limit(1000).lean() });
});

const ESCRIBEN = ['admin', 'administracion', 'operador_planta'];
const puedeEscribir = (req, _res, next) => (ESCRIBEN.includes(req.user.role) ? next() : next(new HttpError(403, 'Sin permisos para cargar registros')));

registrosRouter.post('/:registro', puedeEscribir, async (req, res) => {
  const def = await defDe(req.params.registro);
  const { fecha, datos } = esquemaRegistro(def).parse(req.body);
  if (def.mensual && (await RegistroServicio.exists({ registro: def.id, fecha }))) throw new HttpError(409, 'Ese mes ya está cargado: corregí la fila existente');
  const doc = await RegistroServicio.create({ registro: def.id, fecha, datos, usuario: req.user.sub });
  res.status(201).json(doc);
});

registrosRouter.patch('/:registro/:id', puedeEscribir, async (req, res) => {
  const def = await defDe(req.params.registro);
  const { fecha, datos } = esquemaRegistro(def).parse(req.body);
  const doc = await RegistroServicio.findOne({ _id: req.params.id, registro: def.id });
  if (!doc) throw new HttpError(404, 'No encontrado');
  doc.set({ fecha, datos });
  await doc.save();
  res.json(doc);
});

registrosRouter.delete('/:registro/:id', puedeEscribir, async (req, res) => {
  const def = await defDe(req.params.registro);
  const r = await RegistroServicio.deleteOne({ _id: req.params.id, registro: def.id });
  if (!r.deletedCount) throw new HttpError(404, 'No encontrado');
  res.status(204).end();
});
