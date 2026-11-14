import { Router } from 'express';
import { z } from 'zod';
import { Movimiento, TIPOS_MOVIMIENTO } from './movimiento.model.js';
import { stock, registrarRechazo, registrarAjuste } from './movimiento.service.js';
import { Organization } from '../organizations/organization.model.js';
import { objectId, dateInput } from '../../lib/validation.js';
import { currentTenant } from '../../lib/tenancy.js';
import { requireRole } from '../../middleware/auth.js';

export const plantaRouter = Router();

// Datos de la cooperativa del usuario (nombre, habilitaciones): los usan la web y la app.
plantaRouter.get('/organizacion', async (_req, res) => {
  const org = await Organization.findById(currentTenant());
  res.json({ id: org._id, nombre: org.nombre, cuit: org.cuit, tipo: org.tipo, habilitaciones: org.habilitaciones });
});

plantaRouter.get('/stock', async (_req, res) => {
  res.json({ items: await stock() });
});

plantaRouter.get('/movimientos', async (req, res) => {
  const query = {};
  if (typeof req.query.material === 'string') query.material = objectId.parse(req.query.material);
  if (typeof req.query.tipo === 'string') query.tipo = z.enum(TIPOS_MOVIMIENTO).parse(req.query.tipo);
  const items = await Movimiento.find(query).sort('-fecha').limit(200).populate('material', 'nombre codigo').populate('usuario', 'nombre');
  res.json({ items });
});

// Material no valorizable que sale de planta hacia disposición final (relleno sanitario).
plantaRouter.post('/rechazos', requireRole('operador_planta', 'administracion'), async (req, res) => {
  const data = z.object({ material: objectId, kg: z.number().positive(), fecha: dateInput.optional(), motivo: z.string().max(300).optional() }).parse(req.body);
  res.status(201).json(await registrarRechazo(data, req.user.sub));
});

// Ajuste de inventario (conteo físico). Solo admin: modifica el stock sin una operación real.
plantaRouter.post('/ajustes', requireRole(), async (req, res) => {
  const data = z.object({ material: objectId, kg: z.number().refine((n) => n !== 0, 'El ajuste no puede ser 0'), motivo: z.string().min(3).max(300) }).parse(req.body);
  res.status(201).json(await registrarAjuste(data, req.user.sub));
});
