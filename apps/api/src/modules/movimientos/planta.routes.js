import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { Movimiento, TIPOS_MOVIMIENTO, CAUSAS_RECHAZO, ORIGENES } from './movimiento.model.js';
import { stock, registrarRechazo, registrarAjuste, registrarClasificacion, calidadSeparacion, recuperacionMezcla } from './movimiento.service.js';
import { storage } from '../../lib/storage.js';
import { HttpError } from '../../middleware/error.js';
import { endOfLocalDay, startOfLocalMonth } from '../../lib/validation.js';
import { Organization } from '../organizations/organization.model.js';
import { objectId, dateInput } from '../../lib/validation.js';
import { currentTenant } from '../../lib/tenancy.js';
import { requireRole } from '../../middleware/auth.js';

export const plantaRouter = Router();

// Datos de la cooperativa del usuario (nombre, habilitaciones): los usan la web y la app.
plantaRouter.get('/organizacion', async (_req, res) => {
  const org = await Organization.findById(currentTenant());
  res.json({ id: org._id, nombre: org.nombre, cuit: org.cuit, tipo: org.tipo, habilitaciones: org.habilitaciones, certificado: org.certificado ?? {} });
});

// Datos que firman los certificados (responsable y cargo). Solo admin.
plantaRouter.patch('/organizacion', requireRole(), async (req, res) => {
  const data = z.object({ responsable: z.string().max(120).optional(), cargo: z.string().max(120).optional() }).parse(req.body);
  const org = await Organization.findById(currentTenant());
  org.set({ 'certificado.responsable': data.responsable, 'certificado.cargo': data.cargo });
  await org.save();
  res.json({ certificado: org.certificado });
});

// Registros e inscripciones de la cooperativa (van impresos en el certificado). Solo admin.
const registroInput = z.object({
  descripcion: z.string().min(2).max(160),
  organismo: z.string().max(160).optional(),
  numero: z.string().min(1).max(60),
  corriente: z.enum(['rsu', 'regu', 'peligroso', 'industrial', 'fitosanitario']).optional(),
  vence: dateInput.optional(),
});
plantaRouter.put('/organizacion/registros', requireRole(), async (req, res) => {
  const registros = z.array(registroInput).max(10).parse(req.body.registros);
  const org = await Organization.findById(currentTenant());
  org.set('habilitaciones.registros', registros);
  await org.save();
  res.json({ registros: org.habilitaciones.registros });
});

// Firma y sello escaneados para el certificado (PNG o JPG, hasta 2 MB).
const subirImagen = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, ['image/png', 'image/jpeg'].includes(file.mimetype)),
});
plantaRouter.post('/organizacion/:tipo', requireRole(), subirImagen.single('imagen'), async (req, res) => {
  if (!['firma', 'sello'].includes(req.params.tipo)) throw new HttpError(404, 'Solo se puede subir la firma o el sello');
  if (!req.file) throw new HttpError(400, 'Subí una imagen PNG o JPG de hasta 2 MB');
  const url = await storage.save(req.file.buffer, { prefix: 'certificados', mimetype: req.file.mimetype });
  const org = await Organization.findById(currentTenant());
  org.set(`certificado.${req.params.tipo}Url`, url);
  await org.save();
  res.status(201).json({ certificado: org.certificado });
});

plantaRouter.get('/stock', async (_req, res) => {
  res.json({ items: await stock() });
});

plantaRouter.get('/movimientos', async (req, res) => {
  const query = {};
  if (typeof req.query.material === 'string') query.material = objectId.parse(req.query.material);
  if (typeof req.query.tipo === 'string') query.tipo = z.enum(TIPOS_MOVIMIENTO).parse(req.query.tipo);
  const items = await Movimiento.find(query).sort('-fecha').limit(200).populate('material', 'nombre codigo').populate('usuario', 'nombre');
  res.json({ items });
});

// Material no valorizable que sale de planta hacia disposición final (relleno sanitario).
plantaRouter.post('/rechazos', requireRole('operador_planta', 'administracion'), async (req, res) => {
  const data = z
    .object({
      material: objectId,
      kg: z.number().positive(),
      fecha: dateInput.optional(),
      motivo: z.string().max(300).optional(),
      causa: z.enum(CAUSAS_RECHAZO).optional(),
      cliente: objectId.optional(), // generador que entregó el material mal separado
      origenTipo: z.enum(ORIGENES).optional(),
    })
    .parse(req.body);
  res.status(201).json(await registrarRechazo(data, req.user.sub));
});

// Ajuste de inventario (conteo físico). Solo admin: modifica el stock sin una operación real.
plantaRouter.post('/ajustes', requireRole(), async (req, res) => {
  const data = z.object({ material: objectId, kg: z.number().refine((n) => n !== 0, 'El ajuste no puede ser 0'), motivo: z.string().min(3).max(300) }).parse(req.body);
  res.status(201).json(await registrarAjuste(data, req.user.sub));
});

// Clasificación de residuo mezclado (camión municipal): se reparte en materiales y el resto
// se rechaza a disposición final.
plantaRouter.post('/clasificacion', requireRole('operador_planta', 'administracion'), async (req, res) => {
  const data = z
    .object({
      desde: objectId,
      fecha: dateInput.optional(),
      items: z.array(z.object({ material: objectId, kg: z.number().positive() })).default([]),
      rechazoKg: z.number().min(0).default(0),
      causa: z.enum(CAUSAS_RECHAZO).optional(),
      origenTipo: z.enum(ORIGENES).default('recoleccion_municipal'),
    })
    .refine((d) => d.items.length || d.rechazoKg > 0, 'Cargá al menos un material clasificado o el rechazo')
    .parse(req.body);
  res.status(201).json(await registrarClasificacion(data, req.user.sub));
});

// Calidad de separación por origen (generador o recolección municipal) y recuperación de la mezcla.
plantaRouter.get('/calidad', async (req, res) => {
  const { desde, hasta } = z.object({ desde: dateInput.default(startOfLocalMonth()), hasta: dateInput.optional() }).parse(req.query);
  const hastaFin = hasta ? endOfLocalDay(hasta) : new Date();
  const [origenes, mezcla] = await Promise.all([calidadSeparacion(desde, hastaFin), recuperacionMezcla(desde, hastaFin)]);
  res.json({ periodo: { desde, hasta: hastaFin }, origenes, mezcla });
});
