import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import mongoose from 'mongoose';
import { identificarResiduos } from '../../lib/ia-residuos.js';
import { storage } from '../../lib/storage.js';
import { HttpError } from '../../middleware/error.js';

const subirImagen = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (_r, f, cb) => cb(null, f.mimetype.startsWith('image/')) });

const itemSchema = new mongoose.Schema({
  tipo: String,
  material: String,
  reciclable: Boolean,
  peligroso: Boolean,
  corriente: String,
  cantidad_estimada: String,
  estado: String,
}, { _id: false });

const reporteSchema = new mongoose.Schema({
  foto: String,
  ubicacion: { lat: Number, lng: Number, precision: Number, direccion: String },
  items: [itemSchema],
  observaciones: String,
  recomendacion: String,
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  provincia: String,
  municipio: String,
  notas: String,
}, { timestamps: true });

const ReporteVecino = mongoose.model('ReporteVecino', reporteSchema);

const GUIA_RECICLAJE = {
  papel: { contenedor: 'Azul', instruccion: 'Sacale ganchos y clips. Si está mojado o con comida, va a basura.' },
  carton: { contenedor: 'Azul', instruccion: 'Desarmalo y aplastalo. Sin cinta adhesiva si es posible.' },
  plastico: { contenedor: 'Amarillo', instruccion: 'Enjuagalo y aplastalo. Fijate el número de reciclaje (1-PET y 2-HDPE son los más reciclables).' },
  vidrio: { contenedor: 'Verde', instruccion: 'Enjuagalo. No mezcles con cerámica o espejos.' },
  metal: { contenedor: 'Amarillo', instruccion: 'Enjuagá latas y aplastalás. Las tapitas van aparte.' },
  organico: { contenedor: 'Marrón / compostera', instruccion: 'Restos de comida, yerba, cáscaras. Si tenés compostera, mejor.' },
  electronico: { contenedor: 'Punto verde / punto limpio', instruccion: 'Nunca a la basura común. Llevalo a un punto de recolección de RAEE.' },
  peligroso: { contenedor: 'Punto limpio municipal', instruccion: 'Pilas, aceites, pinturas, medicamentos vencidos. Consultar punto de acopio en tu municipio.' },
  textil: { contenedor: 'Contenedor textil / donación', instruccion: 'Si está en buen estado, doná. Si no, llevá a un punto de reciclaje textil.' },
  default: { contenedor: 'Basura común (negro)', instruccion: 'No es reciclable o está muy contaminado. Embolsá bien.' },
};

function guiaParaItem(item) {
  const mat = (item.material ?? item.tipo ?? '').toLowerCase();
  for (const [key, guia] of Object.entries(GUIA_RECICLAJE)) {
    if (key !== 'default' && mat.includes(key)) return guia;
  }
  if (item.peligroso) return GUIA_RECICLAJE.peligroso;
  if (item.reciclable === false) return GUIA_RECICLAJE.default;
  return GUIA_RECICLAJE.default;
}

export const vecinoRouter = Router();

vecinoRouter.post('/reportar', subirImagen.single('foto'), async (req, res) => {
  if (!req.file) throw new HttpError(422, 'Adjuntá la foto en el campo "foto"');

  const fotoUrl = await storage.save(req.file.buffer, { prefix: 'vecino', mimetype: req.file.mimetype });
  const resultado = await identificarResiduos(req.file.buffer, req.file.mimetype);
  if (!resultado.disponible) throw new HttpError(503, resultado.motivo);

  const ubicacion = req.body.lat ? {
    lat: Number(req.body.lat),
    lng: Number(req.body.lng),
    precision: req.body.precision ? Number(req.body.precision) : undefined,
    direccion: req.body.direccion || undefined,
  } : undefined;

  const items = (resultado.datos.items ?? []).map((it) => ({
    ...it,
    guia: guiaParaItem(it),
  }));

  const doc = await ReporteVecino.create({
    foto: fotoUrl,
    ubicacion,
    items: resultado.datos.items,
    observaciones: resultado.datos.observaciones,
    recomendacion: resultado.datos.recomendacion,
    usuario: req.user._id,
    provincia: req.body.provincia,
    municipio: req.body.municipio,
    notas: req.body.notas,
  });

  res.status(201).json({
    ...doc.toObject(),
    items: items,
  });
});

vecinoRouter.get('/reportes', async (req, res) => {
  const items = await ReporteVecino.find({ usuario: req.user._id }).sort('-createdAt').limit(50);
  const conGuia = items.map((r) => ({
    ...r.toObject(),
    items: (r.items ?? []).map((it) => ({ ...it.toObject?.() ?? it, guia: guiaParaItem(it) })),
  }));
  res.json({ items: conGuia });
});

vecinoRouter.get('/guia', (_req, res) => {
  res.json(GUIA_RECICLAJE);
});

vecinoRouter.delete('/reportes/:id', async (req, res) => {
  const doc = await ReporteVecino.findOneAndDelete({ _id: req.params.id, usuario: req.user._id });
  if (!doc) throw new HttpError(404, 'Reporte no encontrado');
  res.json({ eliminado: true });
});
