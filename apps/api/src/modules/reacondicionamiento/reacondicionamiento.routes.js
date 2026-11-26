import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { Equipo, TIPOS_EQUIPO, ESTADOS_EQUIPO } from './reacondicionamiento.model.js';
import { storage } from '../../lib/storage.js';
import { HttpError } from '../../middleware/error.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (_r, f, cb) => cb(null, f.mimetype.startsWith('image/')) });

const crearZ = z.object({
  tipo: z.enum(TIPOS_EQUIPO),
  marca: z.string().optional(),
  modelo: z.string().optional(),
  numeroSerie: z.string().min(1, 'Número de serie requerido'),
  origenNombre: z.string().optional(),
  origenCuit: z.string().optional(),
  fechaIngreso: z.string().optional(),
  procesador: z.string().optional(),
  ram: z.string().optional(),
  almacenamiento: z.string().optional(),
  pantalla: z.string().optional(),
  sistemaOperativo: z.string().optional(),
  otrasSpecs: z.string().optional(),
  diagnosticoInicial: z.string().optional(),
  notas: z.string().optional(),
});

const intervencionZ = z.object({
  tipo: z.string().min(1),
  descripcion: z.string().optional(),
  piezas: z.string().optional(),
  costo: z.number().optional(),
  tecnico: z.string().optional(),
});

export const reacondicionamientoRouter = Router();

// Crear equipo
reacondicionamientoRouter.post('/', upload.array('fotos', 5), async (req, res) => {
  const data = crearZ.parse(typeof req.body.datos === 'string' ? JSON.parse(req.body.datos) : req.body);
  let fotos = [];
  if (req.files?.length) {
    fotos = await Promise.all(req.files.map((f) => storage.save(f.buffer, { prefix: 'reacond', mimetype: f.mimetype })));
  }
  const doc = await Equipo.create({
    ...data,
    fechaIngreso: data.fechaIngreso ? new Date(data.fechaIngreso) : new Date(),
    fotos,
    usuario: req.user.sub,
  });
  res.status(201).json(doc);
});

// Listar equipos
reacondicionamientoRouter.get('/', async (req, res) => {
  const filter = {};
  if (req.query.estado) filter.estado = req.query.estado;
  const items = await Equipo.find(filter).sort('-createdAt').limit(500).lean();
  res.json({ items });
});

// Estadísticas rápidas
reacondicionamientoRouter.get('/stats', async (_req, res) => {
  const all = await Equipo.find().select('estado costoTotal precioVenta').lean();
  const porEstado = {};
  for (const e of ESTADOS_EQUIPO) porEstado[e] = 0;
  let costoTotal = 0;
  let ventaTotal = 0;
  for (const e of all) {
    porEstado[e.estado] = (porEstado[e.estado] ?? 0) + 1;
    costoTotal += e.costoTotal ?? 0;
    if (e.estado === 'vendido') ventaTotal += e.precioVenta ?? 0;
  }
  res.json({ total: all.length, porEstado, costoTotal, ventaTotal });
});

// Detalle
reacondicionamientoRouter.get('/:id', async (req, res) => {
  const doc = await Equipo.findById(req.params.id).lean();
  if (!doc) throw new HttpError(404, 'Equipo no encontrado');
  res.json(doc);
});

// Cambiar estado
reacondicionamientoRouter.patch('/:id/estado', async (req, res) => {
  const { estado } = z.object({ estado: z.enum(ESTADOS_EQUIPO) }).parse(req.body);
  const doc = await Equipo.findByIdAndUpdate(req.params.id, { estado, ...(estado === 'vendido' ? { fechaSalida: new Date() } : {}) }, { new: true });
  if (!doc) throw new HttpError(404, 'Equipo no encontrado');
  res.json(doc);
});

// Agregar intervención
reacondicionamientoRouter.post('/:id/intervenciones', async (req, res) => {
  const data = intervencionZ.parse(req.body);
  const doc = await Equipo.findById(req.params.id);
  if (!doc) throw new HttpError(404, 'Equipo no encontrado');
  doc.intervenciones.push(data);
  doc.costoTotal = doc.intervenciones.reduce((s, i) => s + (i.costo ?? 0), 0);
  await doc.save();
  res.status(201).json(doc);
});

// Editar equipo (precio, destino, specs, etc.)
reacondicionamientoRouter.patch('/:id', async (req, res) => {
  const allowed = ['precioVenta', 'destinoFinal', 'notas', 'procesador', 'ram', 'almacenamiento', 'pantalla', 'sistemaOperativo', 'otrasSpecs', 'diagnosticoInicial'];
  const update = {};
  for (const k of allowed) if (req.body[k] !== undefined) update[k] = req.body[k];
  const doc = await Equipo.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!doc) throw new HttpError(404, 'Equipo no encontrado');
  res.json(doc);
});

// Subir foto adicional
reacondicionamientoRouter.post('/:id/fotos', upload.single('foto'), async (req, res) => {
  if (!req.file) throw new HttpError(422, 'Adjuntá la foto');
  const url = await storage.save(req.file.buffer, { prefix: 'reacond', mimetype: req.file.mimetype });
  const doc = await Equipo.findByIdAndUpdate(req.params.id, { $push: { fotos: url } }, { new: true });
  if (!doc) throw new HttpError(404, 'Equipo no encontrado');
  res.json(doc);
});

// Eliminar equipo
reacondicionamientoRouter.delete('/:id', async (req, res) => {
  const doc = await Equipo.findByIdAndDelete(req.params.id);
  if (!doc) throw new HttpError(404, 'Equipo no encontrado');
  res.json({ eliminado: true });
});
