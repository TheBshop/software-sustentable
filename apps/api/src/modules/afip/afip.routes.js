// AFIP: emisión y listado de comprobantes electrónicos.
import { Router } from 'express';
import { z } from 'zod';
import { ComprobanteAfip, TIPOS_CBTE, CONCEPTOS, MONEDAS, DOC_TIPOS, COND_IVA_RECEPTOR, fmtComprobante } from './comprobante.model.js';
import { emitirComprobante } from './afip.service.js';
import { renderComprobantePdf } from './comprobante.pdf.js';
import { dummy } from './wsfe.js';
import { requireRole } from '../../middleware/auth.js';
import { HttpError } from '../../middleware/error.js';
import { dateInput, objectId } from '../../lib/validation.js';

export const afipRouter = Router();

afipRouter.get('/catalogos', (_req, res) => {
  res.json({ tipos: TIPOS_CBTE, conceptos: CONCEPTOS, monedas: MONEDAS, docTipos: DOC_TIPOS, condIvaReceptor: COND_IVA_RECEPTOR });
});

afipRouter.get('/estado', async (_req, res) => {
  res.json(await dummy());
});

afipRouter.get('/comprobantes', async (req, res) => {
  const { tipo, limit } = z.object({ tipo: z.coerce.number().int().optional(), limit: z.coerce.number().int().min(1).max(500).default(100) }).parse(req.query);
  const q = tipo ? { tipo } : {};
  const items = await ComprobanteAfip.find(q).sort('-fecha -numero').limit(limit).populate('invoice', 'numero cliente').lean();
  res.json({ items: items.map((c) => ({ ...c, codigo: fmtComprobante(c) })) });
});

afipRouter.get('/comprobantes/:id', async (req, res) => {
  const c = await ComprobanteAfip.findById(req.params.id).populate('invoice').lean();
  if (!c) throw new HttpError(404, 'Comprobante no encontrado');
  res.json({ ...c, codigo: fmtComprobante(c) });
});

afipRouter.get('/comprobantes/:id/pdf', async (req, res) => {
  const c = await ComprobanteAfip.findById(req.params.id);
  if (!c) throw new HttpError(404, 'Comprobante no encontrado');
  res.type('application/pdf').setHeader('Content-Disposition', `inline; filename="${fmtComprobante(c)}.pdf"`);
  await renderComprobantePdf(req.params.id, res);
});

const emitirInput = z.object({
  tipo: z.coerce.number().int().optional(),
  fecha: dateInput.optional(),
  concepto: z.coerce.number().int().min(1).max(3).optional(),
  docTipo: z.coerce.number().int().optional(),
  docNro: z.string().optional(),
  condIvaReceptor: z.coerce.number().int().optional(),
  receptorNombre: z.string().trim().max(160).optional(),
  moneda: z.enum(Object.keys(MONEDAS)).optional(),
  cotizacion: z.number().positive().optional(),
  importeNeto: z.number().min(0),
  importeIva: z.number().min(0).optional(),
  importeExento: z.number().min(0).optional(),
  importeNoGravado: z.number().min(0).optional(),
  importeTributos: z.number().min(0).optional(),
  importeTotal: z.number().min(0),
  iva: z.array(z.object({ tasa: z.number(), baseImp: z.number().min(0), importe: z.number().min(0) })).optional(),
  invoice: objectId.optional(),
});

afipRouter.post('/comprobantes', requireRole('administracion'), async (req, res) => {
  const d = emitirInput.parse(req.body);
  const c = await emitirComprobante(d, { usuario: req.user.sub });
  res.status(201).json({ ...c.toObject(), codigo: fmtComprobante(c) });
});
