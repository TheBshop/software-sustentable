// Consumos y combustible: CRUD + resumen de huella de carbono.
import { Router } from 'express';
import { z } from 'zod';
import { ConsumoServicio, Vehiculo, CargaCombustible } from './consumo.model.js';
import { TIPOS_SERVICIO, TIPOS_COMBUSTIBLE, FACTOR_CO2_SERVICIO, FACTOR_CO2_COMBUSTIBLE, UNIDAD_SERVICIO, UNIDAD_COMBUSTIBLE } from './factores.js';
import { Intake } from '../plant/plant.models.js';
import { Material } from '../materials/material.model.js';
import { objectId, dateInput } from '../../lib/validation.js';
import { requireRole } from '../../middleware/auth.js';
import { HttpError } from '../../middleware/error.js';

export const consumosRouter = Router();
consumosRouter.use(requireRole('administracion'));

// --------- Catálogos ---------
consumosRouter.get('/catalogos', (_req, res) => {
  res.json({
    serviciosTipos: TIPOS_SERVICIO,
    combustiblesTipos: TIPOS_COMBUSTIBLE,
    factoresServicio: FACTOR_CO2_SERVICIO,
    factoresCombustible: FACTOR_CO2_COMBUSTIBLE,
  });
});

// --------- Consumos de servicios ---------
const servicioInput = z.object({
  tipo: z.enum(TIPOS_SERVICIO),
  fecha: dateInput,
  periodoDesde: dateInput.optional(),
  periodoHasta: dateInput.optional(),
  cantidad: z.number().min(0),
  unidad: z.string().optional(),
  importe: z.number().min(0).optional(),
  proveedor: z.string().max(100).optional(),
  sede: z.string().max(200).optional(),
  observaciones: z.string().max(500).optional(),
});

consumosRouter.get('/servicios', async (req, res) => {
  const q = {};
  if (typeof req.query.tipo === 'string') q.tipo = req.query.tipo;
  const items = await ConsumoServicio.find(q).sort('-fecha').limit(500);
  res.json({ items });
});
consumosRouter.post('/servicios', async (req, res) => {
  const d = servicioInput.parse(req.body);
  if (!d.unidad) d.unidad = UNIDAD_SERVICIO(d.tipo);
  const c = await ConsumoServicio.create(d);
  res.status(201).json(c);
});
consumosRouter.delete('/servicios/:id', async (req, res) => {
  const r = await ConsumoServicio.deleteOne({ _id: req.params.id });
  if (!r.deletedCount) throw new HttpError(404, 'No encontrado');
  res.json({ ok: true });
});

// --------- Vehículos ---------
const vehiculoInput = z.object({
  patente: z.string().min(2).max(20),
  marca: z.string().max(50).optional(),
  modelo: z.string().max(50).optional(),
  anio: z.number().int().optional(),
  tipoCombustible: z.enum(TIPOS_COMBUSTIBLE),
  capacidadKg: z.number().positive().optional(),
  activo: z.boolean().optional(),
});

consumosRouter.get('/vehiculos', async (_req, res) => {
  const items = await Vehiculo.find().sort('patente');
  res.json({ items });
});
consumosRouter.post('/vehiculos', async (req, res) => {
  const d = vehiculoInput.parse(req.body);
  res.status(201).json(await Vehiculo.create(d));
});
consumosRouter.delete('/vehiculos/:id', async (req, res) => {
  const r = await Vehiculo.deleteOne({ _id: req.params.id });
  if (!r.deletedCount) throw new HttpError(404, 'No encontrado');
  res.json({ ok: true });
});

// --------- Cargas de combustible ---------
const combustibleInput = z.object({
  vehiculo: objectId,
  fecha: dateInput,
  tipoCombustible: z.enum(TIPOS_COMBUSTIBLE).optional(),
  cantidad: z.number().min(0),
  importe: z.number().min(0).optional(),
  kmActual: z.number().int().optional(),
  observaciones: z.string().max(500).optional(),
});

consumosRouter.get('/combustibles', async (_req, res) => {
  const items = await CargaCombustible.find().sort('-fecha').limit(500).populate('vehiculo', 'patente tipoCombustible');
  res.json({ items });
});
consumosRouter.post('/combustibles', async (req, res) => {
  const d = combustibleInput.parse(req.body);
  const v = await Vehiculo.findById(d.vehiculo);
  if (!v) throw new HttpError(404, 'Vehículo no encontrado');
  d.tipoCombustible ??= v.tipoCombustible;
  d.unidad = UNIDAD_COMBUSTIBLE(d.tipoCombustible);
  res.status(201).json(await CargaCombustible.create(d));
});
consumosRouter.delete('/combustibles/:id', async (req, res) => {
  const r = await CargaCombustible.deleteOne({ _id: req.params.id });
  if (!r.deletedCount) throw new HttpError(404, 'No encontrado');
  res.json({ ok: true });
});

// --------- Huella de carbono consolidada ---------
consumosRouter.get('/huella', async (req, res) => {
  const { anio, mes } = z.object({ anio: z.coerce.number().int().min(2020).max(2100), mes: z.coerce.number().int().min(1).max(12).optional() }).parse(req.query);
  const desde = new Date(Date.UTC(anio, (mes ?? 1) - 1, 1));
  const hasta = mes ? new Date(Date.UTC(anio, mes, 1)) : new Date(Date.UTC(anio + 1, 0, 1));

  const [servicios, combustibles, ingresos, materiales] = await Promise.all([
    ConsumoServicio.find({ fecha: { $gte: desde, $lt: hasta } }).lean(),
    CargaCombustible.find({ fecha: { $gte: desde, $lt: hasta } }).lean(),
    Intake.find({ fecha: { $gte: desde, $lt: hasta } }).lean(),
    Material.find().lean(),
  ]);

  const materialesPorId = new Map(materiales.map((m) => [String(m._id), m]));

  // Emitido
  const emitidoPorServicio = {};
  for (const s of servicios) emitidoPorServicio[s.tipo] = (emitidoPorServicio[s.tipo] || 0) + (s.kgCo2 || 0);
  const emitidoPorCombustible = {};
  for (const c of combustibles) emitidoPorCombustible[c.tipoCombustible] = (emitidoPorCombustible[c.tipoCombustible] || 0) + (c.kgCo2 || 0);

  const emitidoKg = Object.values(emitidoPorServicio).reduce((a, b) => a + b, 0) + Object.values(emitidoPorCombustible).reduce((a, b) => a + b, 0);

  // Evitado (por recuperación de materiales) — kg procesado × factorCo2 del material (excepto los que van a disposición final)
  let evitadoKg = 0;
  const evitadoPorMaterial = new Map();
  for (const i of ingresos) {
    for (const it of i.items || []) {
      const m = materialesPorId.get(String(it.material));
      if (!m || m.tratamiento === 'disposicion_final' || !m.factorCo2) continue;
      const kgCo2 = (it.pesoKg || 0) * m.factorCo2;
      evitadoKg += kgCo2;
      const prev = evitadoPorMaterial.get(m.codigo) || { nombre: m.nombre, codigo: m.codigo, kgProcesado: 0, kgCo2: 0 };
      prev.kgProcesado += it.pesoKg || 0;
      prev.kgCo2 += kgCo2;
      evitadoPorMaterial.set(m.codigo, prev);
    }
  }

  const neto = evitadoKg - emitidoKg;
  const round = (n) => Math.round(n * 100) / 100;

  res.json({
    periodo: { anio, mes, desde, hasta },
    emitido: {
      totalKg: round(emitidoKg),
      porServicio: Object.fromEntries(Object.entries(emitidoPorServicio).map(([k, v]) => [k, round(v)])),
      porCombustible: Object.fromEntries(Object.entries(emitidoPorCombustible).map(([k, v]) => [k, round(v)])),
    },
    evitado: {
      totalKg: round(evitadoKg),
      porMaterial: [...evitadoPorMaterial.values()].map((m) => ({ ...m, kgProcesado: round(m.kgProcesado), kgCo2: round(m.kgCo2) })),
    },
    netoKg: round(neto),
    esNegativo: neto < 0, // true = la operación emite más de lo que evita
  });
});
