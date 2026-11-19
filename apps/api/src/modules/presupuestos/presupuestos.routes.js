import { Router } from 'express';
import { z } from 'zod';
import { Presupuesto, ESTADOS_PRESUPUESTO } from './presupuesto.model.js';
import { crearPresupuesto, convertirEnFactura, cambiarEstado } from './presupuesto.service.js';
import { renderPresupuestoPdf } from './presupuesto.pdf.js';
import { Organization } from '../organizations/organization.model.js';
import { objectId, dateInput } from '../../lib/validation.js';
import { requireRole } from '../../middleware/auth.js';
import { currentTenant } from '../../lib/tenancy.js';
import { HttpError } from '../../middleware/error.js';

export const presupuestosRouter = Router();
presupuestosRouter.use(requireRole('administracion'));

const presupuestoInput = z.object({
  cliente: objectId,
  vigenciaHasta: dateInput,
  notas: z.string().max(500).optional(),
  lineas: z.array(z.object({
    descripcion: z.string().min(1).max(200),
    cantidad: z.number().positive().default(1),
    unidad: z.string().max(30).optional(),
    precioUnitario: z.number().min(0),
  })).min(1),
});

presupuestosRouter.get('/', async (req, res) => {
  const query = {};
  for (const f of ['cliente', 'estado']) if (typeof req.query[f] === 'string') query[f] = req.query[f];
  const items = await Presupuesto.find(query).sort('-emitidoEn').limit(200).populate('cliente', 'razonSocial');
  res.json({ items });
});

presupuestosRouter.get('/:id', async (req, res) => {
  const p = await Presupuesto.findById(req.params.id).populate('cliente', 'razonSocial cuit');
  if (!p) throw new HttpError(404, 'Presupuesto no encontrado');
  res.json(p);
});

presupuestosRouter.post('/', async (req, res) => {
  res.status(201).json(await crearPresupuesto(presupuestoInput.parse(req.body)));
});

presupuestosRouter.post('/:id/convertir', async (req, res) => {
  const data = z.object({ vencimiento: dateInput.optional() }).parse(req.body || {});
  res.json(await convertirEnFactura(req.params.id, data));
});

presupuestosRouter.post('/:id/estado', async (req, res) => {
  const { estado } = z.object({ estado: z.enum(ESTADOS_PRESUPUESTO.filter((e) => e !== 'convertido')) }).parse(req.body);
  res.json(await cambiarEstado(req.params.id, estado));
});

presupuestosRouter.get('/:id/pdf', async (req, res) => {
  const p = await Presupuesto.findById(req.params.id);
  if (!p) throw new HttpError(404, 'Presupuesto no encontrado');
  const org = await Organization.findById(currentTenant()).lean();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="presupuesto-${p.numero}.pdf"`);
  renderPresupuestoPdf(p, org, res);
});
