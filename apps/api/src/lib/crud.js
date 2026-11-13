import { Router } from 'express';
import { HttpError } from '../middleware/error.js';
import { requireRole } from '../middleware/auth.js';
import { escapeRegex } from './validation.js';

/**
 * Genera un router REST estándar (list / get / create / update / delete) para un modelo.
 * Sirve para los ABM simples (clientes, materiales, ingresos, ventas). Las entidades con
 * lógica de negocio (retiros, certificados, facturas) tienen routers propios.
 *
 * - Si el modelo tiene campo `activo`, DELETE hace baja lógica (no se pierde historial).
 * - Solo se aceptan como filtro los campos listados en `filters` (evita inyección de queries).
 */
export function crudRouter(Model, { createSchema, updateSchema, searchFields = [], filters = [], populate = '', sort = '-createdAt', writeRoles = [] }) {
  const router = Router();
  const canWrite = requireRole(...writeRoles);
  const hasSoftDelete = Boolean(Model.schema.path('activo'));

  router.get('/', async (req, res) => {
    const { q, page = '1', limit = '50', incluirInactivos } = req.query;
    const query = {};
    if (q && searchFields.length) {
      query.$or = searchFields.map((f) => ({ [f]: { $regex: escapeRegex(String(q)), $options: 'i' } }));
    }
    for (const f of filters) if (typeof req.query[f] === 'string') query[f] = req.query[f];
    if (hasSoftDelete && incluirInactivos !== 'true') query.activo = true;

    const lim = Math.min(Number(limit) || 50, 200);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * lim;
    const [items, total] = await Promise.all([
      Model.find(query).sort(sort).skip(skip).limit(lim).populate(populate),
      Model.countDocuments(query),
    ]);
    res.json({ items, total, page: Number(page), limit: lim });
  });

  router.get('/:id', async (req, res) => {
    const doc = await Model.findById(req.params.id).populate(populate);
    if (!doc) throw new HttpError(404, 'No encontrado');
    res.json(doc);
  });

  router.post('/', canWrite, async (req, res) => {
    const data = createSchema.parse(req.body);
    const doc = await Model.create(data);
    res.status(201).json(doc);
  });

  router.patch('/:id', canWrite, async (req, res) => {
    const data = (updateSchema ?? createSchema.partial()).parse(req.body);
    const doc = await Model.findById(req.params.id);
    if (!doc) throw new HttpError(404, 'No encontrado');
    doc.set(data);
    await doc.save(); // save() (no findByIdAndUpdate) para que corran validaciones y hooks
    res.json(doc);
  });

  router.delete('/:id', canWrite, async (req, res) => {
    const doc = hasSoftDelete
      ? await Model.findByIdAndUpdate(req.params.id, { activo: false }, { new: true })
      : await Model.findByIdAndDelete(req.params.id);
    if (!doc) throw new HttpError(404, 'No encontrado');
    res.status(204).end();
  });

  return router;
}
