// Manifiestos de traslado: CRUD, PDF y recepción pública.
import { Router } from 'express';
import { z } from 'zod';
import { Manifiesto, ESTADOS, fmtManifiesto, generarCodigo } from './manifiesto.model.js';
import { renderManifiestoPdf } from './manifiesto.pdf.js';
import { Remito } from '../proceso/proceso.models.js';
import { Organization, CORRIENTES } from '../organizations/organization.model.js';
import { currentTenant, runWithoutTenant } from '../../lib/tenancy.js';
import { nextSeq } from '../../lib/counters.js';
import { requireRole } from '../../middleware/auth.js';
import { HttpError } from '../../middleware/error.js';
import { objectId, dateInput } from '../../lib/validation.js';
import { env } from '../../config/env.js';

export const manifiestosRouter = Router();

const parteInput = z.object({ razonSocial: z.string().trim().max(200).optional(), cuit: z.string().max(20).optional(), direccion: z.string().max(200).optional(), lat: z.number().optional(), lng: z.number().optional() });
const transporteInput = z.object({ razonSocial: z.string().max(200).optional(), cuit: z.string().max(20).optional(), patente: z.string().max(20).optional(), chofer: z.string().max(120).optional(), habilitacion: z.string().max(60).optional() });
const itemInput = z.object({ material: objectId, kg: z.number().positive(), unidades: z.number().int().positive().optional() });
const manifiestoInput = z.object({
  fecha: dateInput.optional(),
  origen: parteInput.optional(),
  destino: parteInput,
  transporte: transporteInput.optional(),
  items: z.array(itemInput).min(1),
  corriente: z.enum(CORRIENTES).optional(),
});

const GESTIONA = requireRole('administracion', 'operador_planta');
const PDF_POPULATE = 'items.material';

manifiestosRouter.get('/', async (_req, res) => {
  const items = await Manifiesto.find().sort('-numero').limit(300).populate('items.material', 'nombre').lean();
  res.json({ items: items.map((m) => ({ ...m, codigoManifiesto: fmtManifiesto(m), kg: (m.items ?? []).reduce((a, i) => a + i.kg, 0) })) });
});

manifiestosRouter.post('/', GESTIONA, async (req, res) => {
  const d = manifiestoInput.parse(req.body);
  const numero = await nextSeq('manifiesto');
  const m = await Manifiesto.create({ ...d, numero, codigo: generarCodigo(), hostWebAlEmitir: env.publicWebUrl });
  res.status(201).json({ ...m.toObject(), codigoManifiesto: fmtManifiesto(m) });
});

manifiestosRouter.post('/desde-remito/:remitoId', GESTIONA, async (req, res) => {
  const r = await Remito.findById(req.params.remitoId).populate('items.material', 'nombre corriente');
  if (!r) throw new HttpError(404, 'Remito no encontrado');
  const corriente = r.items?.[0]?.material?.corriente;
  const numero = await nextSeq('manifiesto');
  const m = await Manifiesto.create({
    numero,
    codigo: generarCodigo(),
    hostWebAlEmitir: env.publicWebUrl,
    fecha: r.fecha,
    remito: r._id,
    destino: r.destinatario ? { razonSocial: r.destinatario.razonSocial, cuit: r.destinatario.cuit } : undefined,
    transporte: r.transporte,
    items: r.items.map((i) => ({ material: i.material._id ?? i.material, kg: i.kg, unidades: i.unidades })),
    corriente,
  });
  res.status(201).json({ ...m.toObject(), codigoManifiesto: fmtManifiesto(m) });
});

manifiestosRouter.get('/:id/pdf', async (req, res) => {
  const m = await Manifiesto.findById(req.params.id).populate(PDF_POPULATE);
  if (!m) throw new HttpError(404, 'Manifiesto no encontrado');
  const org = await Organization.findById(currentTenant()).lean();
  res.type('application/pdf').setHeader('Content-Disposition', `inline; filename="${fmtManifiesto(m)}.pdf"`);
  await renderManifiestoPdf(m, org, res);
});

manifiestosRouter.patch('/:id/en-transito', GESTIONA, async (req, res) => {
  const m = await Manifiesto.findById(req.params.id);
  if (!m) throw new HttpError(404, 'Manifiesto no encontrado');
  if (m.estado !== 'emitido') throw new HttpError(409, `Estado actual: ${m.estado}`);
  m.estado = 'en_transito';
  await m.save();
  res.json({ id: m._id, estado: m.estado });
});

manifiestosRouter.post('/:id/anular', requireRole('administracion'), async (req, res) => {
  const { motivo } = z.object({ motivo: z.string().trim().min(3).max(300) }).parse(req.body);
  const m = await Manifiesto.findById(req.params.id);
  if (!m) throw new HttpError(404, 'Manifiesto no encontrado');
  if (m.estado === 'anulado') throw new HttpError(409, 'Ya está anulado');
  m.set({ estado: 'anulado', motivoAnulacion: motivo });
  await m.save();
  res.json({ id: m._id, estado: m.estado });
});

// ---------- Rutas públicas (recepción por QR) ----------
export const manifiestosPublicosRouter = Router();

manifiestosPublicosRouter.get('/:codigo', async (req, res) => {
  const m = await runWithoutTenant(() => Manifiesto.findOne({ codigo: req.params.codigo }).populate('items.material', 'nombre').lean());
  if (!m) throw new HttpError(404, 'Manifiesto no encontrado');
  const org = await runWithoutTenant(() => Organization.findById(m.coop).select('nombre cuit domicilio').lean());
  res.json({
    codigo: m.codigo,
    numero: fmtManifiesto(m),
    fecha: m.fecha,
    estado: m.estado,
    emisor: { nombre: org?.nombre, cuit: org?.cuit, domicilio: org?.domicilio },
    origen: m.origen,
    destino: m.destino,
    transporte: m.transporte,
    corriente: m.corriente,
    items: m.items,
    recepcion: m.recepcion ? { fecha: m.recepcion.fecha, firmanteNombre: m.recepcion.firmanteNombre } : null,
  });
});

const recepcionInput = z.object({
  firmaBase64: z.string().min(50).max(500000), // dataURL del canvas
  firmanteNombre: z.string().trim().min(2).max(160),
  firmanteDni: z.string().trim().max(20).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  observaciones: z.string().trim().max(500).optional(),
});

manifiestosPublicosRouter.post('/:codigo/recepcion', async (req, res) => {
  const d = recepcionInput.parse(req.body);
  const m = await runWithoutTenant(() => Manifiesto.findOne({ codigo: req.params.codigo }));
  if (!m) throw new HttpError(404, 'Manifiesto no encontrado');
  if (m.estado === 'anulado') throw new HttpError(422, 'El manifiesto está anulado');
  if (m.estado === 'recibido') throw new HttpError(409, 'El manifiesto ya fue recibido');
  m.set({
    estado: 'recibido',
    recepcion: {
      ...d,
      fecha: new Date(),
      ip: req.ip ?? req.headers['x-forwarded-for'] ?? null,
    },
  });
  await m.save();
  res.json({ ok: true, numero: fmtManifiesto(m), fecha: m.recepcion.fecha });
});
