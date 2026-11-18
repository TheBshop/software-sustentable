// Registro de auditoría de la organización: quién cargó, cambió o borró qué (solo admin).
import { Router } from 'express';
import { z } from 'zod';
import { AuditLog } from '../../lib/auditoria.js';

export const auditoriaRouter = Router();

auditoriaRouter.get('/', async (req, res) => {
  const { entidad, entidadId, usuario, limit } = z
    .object({ entidad: z.string().optional(), entidadId: z.string().regex(/^[a-f0-9]{24}$/).optional(), usuario: z.string().regex(/^[a-f0-9]{24}$/).optional(), limit: z.coerce.number().int().min(1).max(500).default(100) })
    .parse(req.query);
  const items = await AuditLog.find({ coop: req.user.org, ...(entidad && { entidad }), ...(entidadId && { entidadId }), ...(usuario && { usuario }) })
    .sort('-fecha')
    .limit(limit)
    .populate('usuario', 'nombre email')
    .lean();
  res.json({ items });
});
