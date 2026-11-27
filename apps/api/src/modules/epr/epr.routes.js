import { Router } from 'express';
import { z } from 'zod';
import { MarcaEPR, ReporteEPR, TIPOS_ENVASE } from './epr.model.js';
import { nextSeq } from '../../lib/counters.js';
import { HttpError } from '../../middleware/error.js';
import { renderReporteEPR } from './epr.pdf.js';

const marcaZ = z.object({
  nombre: z.string().min(1),
  cuit: z.string().optional(),
  contacto: z.object({ nombre: z.string().optional(), email: z.string().email().optional(), telefono: z.string().optional() }).optional(),
  direccion: z.string().optional(),
});

const lineaZ = z.object({
  tipoEnvase: z.enum(TIPOS_ENVASE),
  descripcion: z.string().optional(),
  pesoKg: z.number().positive(),
  co2EvitadoKg: z.number().optional(),
});

const reporteZ = z.object({
  marca: z.string().min(1),
  desde: z.string().min(1),
  hasta: z.string().min(1),
  lineas: z.array(lineaZ).min(1),
  cadenasCustodia: z.array(z.string()).optional(),
  procesosAplicados: z.array(z.string()).optional(),
  puntosRecuperacion: z.array(z.object({ nombre: z.string().optional(), direccion: z.string().optional(), lat: z.number().optional(), lng: z.number().optional() })).optional(),
  observaciones: z.string().optional(),
});

export const eprRouter = Router();

// ---- Marcas ----

eprRouter.get('/marcas', async (_req, res) => {
  const items = await MarcaEPR.find({ activo: true }).sort('nombre').lean();
  res.json({ items });
});

eprRouter.post('/marcas', async (req, res) => {
  const data = marcaZ.parse(req.body);
  const doc = await MarcaEPR.create(data);
  res.status(201).json(doc);
});

eprRouter.patch('/marcas/:id', async (req, res) => {
  const data = marcaZ.partial().parse(req.body);
  const doc = await MarcaEPR.findByIdAndUpdate(req.params.id, data, { new: true });
  if (!doc) throw new HttpError(404, 'Marca no encontrada');
  res.json(doc);
});

eprRouter.delete('/marcas/:id', async (req, res) => {
  await MarcaEPR.findByIdAndUpdate(req.params.id, { activo: false });
  res.json({ ok: true });
});

// ---- Reportes EPR ----

eprRouter.get('/', async (req, res) => {
  const filter = {};
  if (req.query.marca) filter.marca = req.query.marca;
  const items = await ReporteEPR.find(filter).sort('-createdAt').limit(200).populate('marca', 'nombre cuit').lean();
  res.json({ items });
});

eprRouter.post('/', async (req, res) => {
  const data = reporteZ.parse(req.body);
  const marca = await MarcaEPR.findById(data.marca);
  if (!marca) throw new HttpError(404, 'Marca no encontrada');

  const totalKg = data.lineas.reduce((s, l) => s + l.pesoKg, 0);
  const co2EvitadoKg = data.lineas.reduce((s, l) => s + (l.co2EvitadoKg ?? 0), 0);
  const numero = await nextSeq('epr');

  const doc = await ReporteEPR.create({
    numero,
    marca: marca._id,
    marcaSnapshot: { nombre: marca.nombre, cuit: marca.cuit },
    periodo: { desde: new Date(data.desde), hasta: new Date(data.hasta) },
    lineas: data.lineas,
    totalKg,
    co2EvitadoKg,
    cadenasCustodia: data.cadenasCustodia ?? [],
    procesosAplicados: data.procesosAplicados ?? [],
    puntosRecuperacion: data.puntosRecuperacion ?? [],
    observaciones: data.observaciones,
    usuario: req.user.sub,
  });

  res.status(201).json(doc);
});

eprRouter.get('/stats', async (req, res) => {
  const filter = {};
  if (req.query.marca) filter.marca = req.query.marca;
  const all = await ReporteEPR.find(filter).select('totalKg co2EvitadoKg lineas marca').populate('marca', 'nombre').lean();

  const porMarca = {};
  let totalKg = 0;
  let totalCo2 = 0;
  const porTipo = {};

  for (const r of all) {
    const mn = r.marca?.nombre ?? 'Sin marca';
    porMarca[mn] = (porMarca[mn] ?? 0) + r.totalKg;
    totalKg += r.totalKg;
    totalCo2 += r.co2EvitadoKg ?? 0;
    for (const l of r.lineas) {
      porTipo[l.tipoEnvase] = (porTipo[l.tipoEnvase] ?? 0) + l.pesoKg;
    }
  }

  res.json({ total: all.length, totalKg, totalCo2, porMarca, porTipo });
});

eprRouter.get('/:id', async (req, res) => {
  const doc = await ReporteEPR.findById(req.params.id).populate('marca', 'nombre cuit contacto').lean();
  if (!doc) throw new HttpError(404, 'Reporte no encontrado');
  res.json(doc);
});

eprRouter.get('/:id/pdf', async (req, res) => {
  const doc = await ReporteEPR.findById(req.params.id).populate('marca', 'nombre cuit contacto').lean();
  if (!doc) throw new HttpError(404, 'Reporte no encontrado');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="reporte-epr-${doc.numero}.pdf"`);
  renderReporteEPR(res, doc);
});

eprRouter.delete('/:id', async (req, res) => {
  const doc = await ReporteEPR.findByIdAndDelete(req.params.id);
  if (!doc) throw new HttpError(404, 'Reporte no encontrado');
  res.json({ eliminado: true });
});
