import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import multer from 'multer';
import { Destruccion, METODOS_DESTRUCCION, TIPOS_DISPOSITIVO } from './destruccion.model.js';
import { storage } from '../../lib/storage.js';
import { HttpError } from '../../middleware/error.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (_r, f, cb) => cb(null, f.mimetype.startsWith('image/')) });

const dispositivoZ = z.object({
  tipo: z.enum(TIPOS_DISPOSITIVO),
  marca: z.string().optional(),
  modelo: z.string().optional(),
  numeroSerie: z.string().min(1, 'Número de serie requerido'),
  capacidad: z.string().optional(),
  metodo: z.enum(METODOS_DESTRUCCION),
  notas: z.string().optional(),
});

const crearZ = z.object({
  clienteNombre: z.string().min(1, 'Nombre del cliente requerido'),
  clienteCuit: z.string().optional(),
  dispositivos: z.array(dispositivoZ).min(1, 'Al menos un dispositivo'),
  fechaDestruccion: z.string().min(1),
  responsable: z.string().min(1, 'Responsable requerido'),
  observaciones: z.string().optional(),
});

export const destruccionRouter = Router();

destruccionRouter.post('/', upload.single('foto'), async (req, res) => {
  const data = crearZ.parse(typeof req.body.datos === 'string' ? JSON.parse(req.body.datos) : req.body);

  let fotoUrl;
  if (req.file) {
    fotoUrl = await storage.save(req.file.buffer, { prefix: 'destruccion', mimetype: req.file.mimetype });
  }

  const ultimo = await Destruccion.findOne().sort('-numero').select('numero').lean();
  const numero = (ultimo?.numero ?? 0) + 1;
  const codigo = crypto.randomBytes(12).toString('base64url');

  const doc = await Destruccion.create({
    codigo,
    numero,
    clienteNombre: data.clienteNombre,
    clienteCuit: data.clienteCuit || undefined,
    dispositivos: data.dispositivos,
    fechaDestruccion: new Date(data.fechaDestruccion),
    responsable: data.responsable,
    observaciones: data.observaciones || undefined,
    fotoEvidencia: fotoUrl,
    usuario: req.user.sub,
  });

  res.status(201).json(doc);
});

destruccionRouter.get('/', async (_req, res) => {
  const items = await Destruccion.find().sort('-createdAt').limit(200).lean();
  res.json({ items });
});

destruccionRouter.get('/:id', async (req, res) => {
  const doc = await Destruccion.findById(req.params.id).lean();
  if (!doc) throw new HttpError(404, 'Registro no encontrado');
  res.json(doc);
});

destruccionRouter.get('/:id/pdf', async (req, res) => {
  const doc = await Destruccion.findById(req.params.id).lean();
  if (!doc) throw new HttpError(404, 'Registro no encontrado');

  const { renderDestruccionPdf } = await import('./destruccion.pdf.js');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="certificado-destruccion-${doc.numero}.pdf"`);
  await renderDestruccionPdf(doc, res);
});

destruccionRouter.delete('/:id', async (req, res) => {
  const doc = await Destruccion.findByIdAndDelete(req.params.id);
  if (!doc) throw new HttpError(404, 'Registro no encontrado');
  res.json({ eliminado: true });
});
