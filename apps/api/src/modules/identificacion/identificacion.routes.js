import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { Identificacion } from './identificacion.model.js';
import { identificarResiduos } from '../../lib/ia-residuos.js';
import { storage } from '../../lib/storage.js';
import { HttpError } from '../../middleware/error.js';

const subirImagen = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (_r, f, cb) => cb(null, f.mimetype.startsWith('image/')) });

export const identificacionRouter = Router();

identificacionRouter.post('/analizar', subirImagen.single('foto'), async (req, res) => {
  if (!req.file) throw new HttpError(422, 'Adjuntá la foto en el campo "foto"');

  const fotoUrl = await storage.save(req.file.buffer, { prefix: 'identificacion', mimetype: req.file.mimetype });

  const resultado = await identificarResiduos(req.file.buffer, req.file.mimetype);
  if (!resultado.disponible) throw new HttpError(503, resultado.motivo);

  const ubicacion = req.body.lat ? {
    lat: Number(req.body.lat),
    lng: Number(req.body.lng),
    precision: req.body.precision ? Number(req.body.precision) : undefined,
    direccion: req.body.direccion || undefined,
  } : undefined;

  const doc = await Identificacion.create({
    foto: fotoUrl,
    ubicacion,
    items: resultado.datos.items,
    observaciones: resultado.datos.observaciones,
    recomendacion: resultado.datos.recomendacion,
    usuario: req.user._id,
    notas: req.body.notas || undefined,
  });

  res.status(201).json(doc);
});

identificacionRouter.get('/', async (_req, res) => {
  const items = await Identificacion.find().sort('-createdAt').limit(100).populate('usuario', 'nombre');
  res.json({ items });
});

identificacionRouter.get('/:id', async (req, res) => {
  const doc = await Identificacion.findById(req.params.id).populate('usuario', 'nombre');
  if (!doc) throw new HttpError(404, 'Registro no encontrado');
  res.json(doc);
});

identificacionRouter.delete('/:id', async (req, res) => {
  const doc = await Identificacion.findByIdAndDelete(req.params.id);
  if (!doc) throw new HttpError(404, 'Registro no encontrado');
  res.json({ eliminado: true });
});
