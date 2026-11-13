import { Router } from 'express';
import { z } from 'zod';
import { Invoice } from './invoice.model.js';
import { buildInvoiceDraft, createInvoice, registerPayment, cancelInvoice, paymentAlerts } from './invoice.service.js';
import { objectId, dateInput } from '../../lib/validation.js';
import { requireRole } from '../../middleware/auth.js';
import { HttpError } from '../../middleware/error.js';

export const invoicesRouter = Router();
invoicesRouter.use(requireRole('administracion'));

const periodoInput = z
  .object({ cliente: objectId, desde: dateInput, hasta: dateInput, vencimiento: dateInput.optional() })
  .refine((d) => d.desde <= d.hasta, 'El período es inválido');

invoicesRouter.get('/', async (req, res) => {
  const query = {};
  for (const f of ['cliente', 'estado']) if (typeof req.query[f] === 'string') query[f] = req.query[f];
  const items = await Invoice.find(query).sort('-emitidaEn').limit(200).populate('cliente', 'razonSocial');
  res.json({ items });
});

// Debe ir antes de '/:id'
invoicesRouter.get('/alertas', async (req, res) => {
  const dias = z.coerce.number().int().min(0).max(90).default(7).parse(req.query.dias);
  res.json(await paymentAlerts(dias));
});

invoicesRouter.get('/:id', async (req, res) => {
  const inv = await Invoice.findById(req.params.id).populate('cliente', 'razonSocial cuit').populate('retiros', 'numero fecha');
  if (!inv) throw new HttpError(404, 'Factura no encontrada');
  res.json(inv);
});

// Vista previa: qué se facturaría, sin guardar nada.
invoicesRouter.post('/preview', async (req, res) => {
  const { lineas, total, retiros } = await buildInvoiceDraft(periodoInput.parse(req.body));
  res.json({ lineas, total, retiros: retiros.map((r) => ({ id: r._id, numero: r.numero, fecha: r.fecha })) });
});

invoicesRouter.post('/', async (req, res) => {
  res.status(201).json(await createInvoice(periodoInput.parse(req.body)));
});

invoicesRouter.post('/:id/pagos', async (req, res) => {
  const data = z
    .object({ monto: z.number().positive(), fecha: dateInput.optional(), medio: z.string().default('transferencia'), referencia: z.string().optional() })
    .parse(req.body);
  res.status(201).json(await registerPayment(req.params.id, data));
});

invoicesRouter.post('/:id/anular', async (req, res) => {
  res.json(await cancelInvoice(req.params.id));
});
