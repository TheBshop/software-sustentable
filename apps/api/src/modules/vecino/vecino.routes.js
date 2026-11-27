import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { identificarResiduos } from '../../lib/ia-residuos.js';
import { HttpError } from '../../middleware/error.js';
import { IdentificacionVecino, RetiroVecino, PerfilVecino } from './vecino.model.js';
import { renderCertificadoVecino } from './vecino.pdf.js';

const subirImagen = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (_r, f, cb) => cb(null, f.mimetype.startsWith('image/')) });

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

const PESO_ESTIMADO = { plastico: 0.3, papel: 0.2, carton: 0.5, vidrio: 0.8, metal: 0.4, organico: 0.5, electronico: 1.5, textil: 0.6, default: 0.3 };
const CO2_FACTOR = { plastico: 1.5, papel: 0.9, carton: 0.9, vidrio: 0.3, metal: 2.0, electronico: 3.0, textil: 5.0, default: 0.5 };

function guiaParaItem(item) {
  const mat = (item.material ?? item.tipo ?? '').toLowerCase();
  for (const [key, guia] of Object.entries(GUIA_RECICLAJE)) {
    if (key !== 'default' && mat.includes(key)) return guia;
  }
  if (item.peligroso) return GUIA_RECICLAJE.peligroso;
  if (item.reciclable === false) return GUIA_RECICLAJE.default;
  return GUIA_RECICLAJE.default;
}

function estimarPeso(item) {
  const mat = (item.material ?? item.tipo ?? '').toLowerCase();
  for (const key of Object.keys(PESO_ESTIMADO)) {
    if (key !== 'default' && mat.includes(key)) return PESO_ESTIMADO[key];
  }
  return PESO_ESTIMADO.default;
}

function estimarCo2(item) {
  const mat = (item.material ?? item.tipo ?? '').toLowerCase();
  for (const key of Object.keys(CO2_FACTOR)) {
    if (key !== 'default' && mat.includes(key)) return CO2_FACTOR[key];
  }
  return CO2_FACTOR.default;
}

export const vecinoRouter = Router();

// ---- Identificar residuos (con persistencia) ----

vecinoRouter.post('/identificar', subirImagen.single('foto'), async (req, res) => {
  if (!req.file) throw new HttpError(422, 'Adjuntá la foto en el campo "foto"');

  const resultado = await identificarResiduos(req.file.buffer, req.file.mimetype);
  if (!resultado.disponible) throw new HttpError(503, resultado.motivo);

  const items = (resultado.datos.items ?? []).map((it) => {
    const pesoEstimadoKg = estimarPeso(it);
    return { ...it, guia: guiaParaItem(it), pesoEstimadoKg };
  });

  const pesoEstimadoKg = items.reduce((s, i) => s + (i.pesoEstimadoKg ?? 0), 0);
  const co2EvitadoKg = items.filter((i) => i.reciclable).reduce((s, i) => s + estimarCo2(i) * (i.pesoEstimadoKg ?? 0), 0);

  const doc = await IdentificacionVecino.create({
    usuario: req.user.sub,
    items,
    observaciones: resultado.datos.observaciones,
    recomendacion: resultado.datos.recomendacion,
    pesoEstimadoKg,
    co2EvitadoKg,
  });

  res.json({ _id: doc._id, items, observaciones: resultado.datos.observaciones, recomendacion: resultado.datos.recomendacion, pesoEstimadoKg, co2EvitadoKg });
});

// ---- Guía ----

vecinoRouter.get('/guia', (_req, res) => { res.json(GUIA_RECICLAJE); });

// ---- Historial de identificaciones ----

vecinoRouter.get('/identificaciones', async (req, res) => {
  const items = await IdentificacionVecino.find({ usuario: req.user.sub }).sort('-createdAt').limit(100).lean();
  res.json({ items });
});

// ---- Dashboard / stats ----

vecinoRouter.get('/stats', async (req, res) => {
  const userId = req.user.sub;
  const [identAgg] = await IdentificacionVecino.aggregate([
    { $match: { usuario: userId } },
    { $group: { _id: null, total: { $sum: 1 }, pesoKg: { $sum: '$pesoEstimadoKg' }, co2Kg: { $sum: '$co2EvitadoKg' } } },
  ]);
  const retiros = await RetiroVecino.countDocuments({ usuario: userId });
  const retirosCompletados = await RetiroVecino.countDocuments({ usuario: userId, estado: 'retirado' });

  res.json({
    identificaciones: identAgg?.total ?? 0,
    pesoKg: identAgg?.pesoKg ?? 0,
    co2Kg: identAgg?.co2Kg ?? 0,
    retiros,
    retirosCompletados,
  });
});

// ---- Perfil ----

vecinoRouter.get('/perfil', async (req, res) => {
  let perfil = await PerfilVecino.findOne({ usuario: req.user.sub }).lean();
  if (!perfil) perfil = { telefono: '', dni: '', direccion: '', ciudad: '', provincia: '', lat: null, lng: null, fechaNacimiento: null };
  res.json(perfil);
});

vecinoRouter.put('/perfil', async (req, res) => {
  const data = z.object({
    telefono: z.string().optional(),
    dni: z.string().optional(),
    direccion: z.string().optional(),
    ciudad: z.string().optional(),
    provincia: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    fechaNacimiento: z.string().optional(),
  }).parse(req.body);
  const perfil = await PerfilVecino.findOneAndUpdate(
    { usuario: req.user.sub },
    { ...data, usuario: req.user.sub },
    { upsert: true, new: true },
  );
  res.json(perfil);
});

// ---- Retiros ----

vecinoRouter.get('/retiros', async (req, res) => {
  const items = await RetiroVecino.find({ usuario: req.user.sub }).sort('-createdAt').limit(50).lean();
  res.json({ items });
});

vecinoRouter.post('/retiros', async (req, res) => {
  const data = z.object({
    direccion: z.string().min(1, 'La dirección es requerida'),
    ciudad: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    fechaPreferida: z.string().optional(),
    franjaHoraria: z.enum(['manana', 'tarde', 'todo_el_dia']).optional(),
    materiales: z.array(z.string()).optional(),
    observaciones: z.string().optional(),
    pesoEstimadoKg: z.number().optional(),
  }).parse(req.body);

  const doc = await RetiroVecino.create({ ...data, usuario: req.user.sub, fechaPreferida: data.fechaPreferida ? new Date(data.fechaPreferida) : undefined });
  res.status(201).json(doc);
});

vecinoRouter.delete('/retiros/:id', async (req, res) => {
  const doc = await RetiroVecino.findOne({ _id: req.params.id, usuario: req.user.sub });
  if (!doc) throw new HttpError(404, 'Retiro no encontrado');
  if (doc.estado !== 'pendiente') throw new HttpError(400, 'Solo se pueden cancelar retiros pendientes');
  doc.estado = 'cancelado';
  await doc.save();
  res.json({ ok: true });
});

// ---- Certificado de reciclaje ----

vecinoRouter.get('/certificado', async (req, res) => {
  const { User } = await import('../users/user.model.js');
  const user = await User.findById(req.user.sub).lean();
  const perfil = await PerfilVecino.findOne({ usuario: req.user.sub }).lean();

  const [identAgg] = await IdentificacionVecino.aggregate([
    { $match: { usuario: req.user.sub } },
    { $group: { _id: null, total: { $sum: 1 }, pesoKg: { $sum: '$pesoEstimadoKg' }, co2Kg: { $sum: '$co2EvitadoKg' } } },
  ]);

  const stats = { identificaciones: identAgg?.total ?? 0, pesoKg: identAgg?.pesoKg ?? 0, co2Kg: identAgg?.co2Kg ?? 0 };
  if (stats.identificaciones === 0) throw new HttpError(400, 'Todavía no tenés identificaciones para generar un certificado');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="certificado-reciclaje-${user.nombre.replace(/\s+/g, '-')}.pdf"`);
  renderCertificadoVecino(res, user, perfil, stats);
});
