import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { z } from 'zod';
import { Pickup, ESTADOS_RETIRO } from './pickup.model.js';
import { nextSeq } from '../../lib/counters.js';
import { objectId, dateInput, endOfLocalDay } from '../../lib/validation.js';
import { requireRole } from '../../middleware/auth.js';
import { HttpError } from '../../middleware/error.js';
import { env } from '../../config/env.js';
import { issueCertificate } from '../certificates/certificate.service.js';

export const pickupsRouter = Router();

const itemInput = z.object({
  material: objectId,
  pesoEstimadoKg: z.number().min(0),
  pesoRealKg: z.number().min(0).optional(),
});

const createInput = z.object({
  localId: z.string().uuid().optional(),
  cliente: objectId,
  direccion: z.string().optional(),
  fecha: dateInput.optional(),
  items: z.array(itemInput).min(1),
  ubicacion: z.object({ lat: z.number(), lng: z.number() }).optional(),
  observaciones: z.string().max(1000).optional(),
});

const updateInput = z.object({
  items: z.array(itemInput).min(1).optional(),
  estado: z.enum(ESTADOS_RETIRO).optional(),
  observaciones: z.string().max(1000).optional(),
  direccion: z.string().optional(),
});

const POPULATE = [
  { path: 'cliente', select: 'razonSocial cuit contacto' },
  { path: 'items.material', select: 'codigo nombre' },
  { path: 'chofer', select: 'nombre' },
];

pickupsRouter.get('/', async (req, res) => {
  const { cliente, estado, desde, hasta, page = '1', limit = '50' } = req.query;
  const query = {};
  if (typeof cliente === 'string') query.cliente = cliente;
  if (typeof estado === 'string') query.estado = estado;
  if (desde || hasta) {
    query.fecha = {};
    if (desde) query.fecha.$gte = dateInput.parse(desde);
    if (hasta) query.fecha.$lte = endOfLocalDay(dateInput.parse(hasta));
  }
  // Un chofer solo ve sus propios retiros
  if (req.user.role === 'chofer') query.chofer = req.user.sub;

  const lim = Math.min(Number(limit) || 50, 200);
  const [items, total] = await Promise.all([
    Pickup.find(query).sort('-fecha').skip((Number(page) - 1) * lim).limit(lim).populate(POPULATE),
    Pickup.countDocuments(query),
  ]);
  res.json({ items, total });
});

pickupsRouter.get('/:id', async (req, res) => {
  const pickup = await Pickup.findById(req.params.id).populate(POPULATE);
  if (!pickup) throw new HttpError(404, 'Retiro no encontrado');
  res.json(pickup);
});

// Alta de retiro. Idempotente por localId: la app móvil puede reintentar sin duplicar.
pickupsRouter.post('/', requireRole('chofer', 'operador_planta', 'administracion'), async (req, res) => {
  const data = createInput.parse(req.body);
  if (data.localId) {
    const existing = await Pickup.findOne({ localId: data.localId });
    if (existing) return res.status(200).json(existing);
  }
  const pickup = await Pickup.create({ ...data, chofer: req.user.sub, numero: await nextSeq('retiro') });
  res.status(201).json(pickup);
});

// Usado por la planta para cargar el peso real de balanza y pasar el retiro a "en_planta".
pickupsRouter.patch('/:id', requireRole('operador_planta', 'administracion'), async (req, res) => {
  const data = updateInput.parse(req.body);
  const pickup = await Pickup.findById(req.params.id);
  if (!pickup) throw new HttpError(404, 'Retiro no encontrado');
  if (pickup.factura && data.items) throw new HttpError(409, 'El retiro ya fue facturado: no se pueden cambiar los pesos');
  pickup.set(data);
  await pickup.save();
  res.json(pickup);
});

// ---- Fotos ----
// MVP: se guardan en disco. En producción, reemplazar el storage por S3 / Cloudflare R2 / Cloudinary.
fs.mkdirSync(env.uploadsDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: env.uploadsDir,
    filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase() || '.jpg'}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 6 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});

pickupsRouter.post('/:id/fotos', requireRole('chofer', 'operador_planta', 'administracion'), upload.array('fotos', 6), async (req, res) => {
  const pickup = await Pickup.findById(req.params.id);
  if (!pickup) throw new HttpError(404, 'Retiro no encontrado');
  for (const f of req.files ?? []) pickup.fotos.push({ url: `/uploads/${f.filename}` });
  await pickup.save();
  res.status(201).json({ fotos: pickup.fotos });
});

// ---- Certificado ----
pickupsRouter.post('/:id/certificado', requireRole('operador_planta', 'administracion'), async (req, res) => {
  const cert = await issueCertificate(req.params.id);
  res.status(201).json(cert);
});
