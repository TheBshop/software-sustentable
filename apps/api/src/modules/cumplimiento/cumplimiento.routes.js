// Cumplimiento: matriz, autodiagnóstico, carga y baja de evidencias con archivo.
import { Router } from 'express';
import { z } from 'zod';
import { DIAG } from '@nueva-vida/catalogos';
import { Evidencia, estadoEvidencia } from './evidencia.model.js';
import { itemsMatriz, resumenPorArea } from './matriz.js';
import { Organization } from '../organizations/organization.model.js';
import { currentTenant } from '../../lib/tenancy.js';
import multer from 'multer';
import { storage } from '../../lib/storage.js';
import { requireRole } from '../../middleware/auth.js';
import { HttpError } from '../../middleware/error.js';
import { dateInput } from '../../lib/validation.js';
import { perfilDe } from '../registros/registro.model.js';

export const cumplimientoRouter = Router();
const ADMIN = requireRole('administracion');

/** Matriz con el estado real de cada ítem (auto + evidencias cargadas). */
cumplimientoRouter.get('/', async (_req, res) => {
  const org = await Organization.findById(currentTenant()).lean();
  const perfil = perfilDe(org);
  if (perfil === 'municipio') return res.json({ perfil, areas: [], items: [] });
  const corrientes = org.configuracion?.corrientes ?? [];
  const items = itemsMatriz(org, corrientes);
  const evidencias = await Evidencia.find().lean();
  const porItem = new Map(evidencias.map((e) => [e.item, e]));
  const resultado = [];
  for (const it of items) {
    let estado;
    if (it.tipo === 'auto') {
      try {
        const r = await it.check();
        estado = { codigo: r.ok === true ? 'cumple' : r.ok === false ? 'no_cumple' : 'sin_dato', txt: r.txt };
      } catch (err) {
        estado = { codigo: 'sin_dato', txt: 'No se pudo calcular' };
        console.error(`Matriz: falló el check de ${it.id}: ${err.message}`);
      }
    } else {
      const ev = porItem.get(it.id);
      estado = estadoEvidencia(ev);
      if (ev) {
        it.numero = ev.numero;
        it.venceEl = ev.vence; // la fecha cargada; `it.vence` es si el ítem debe vencer
        it.notas = ev.notas;
        it.archivoNombre = ev.archivoNombre;
        it.archivoUrl = ev.archivoUrl;
      }
    }
    const { check, ...resto } = it;
    resultado.push({ ...resto, estado });
  }
  res.json({ perfil, areas: resumenPorArea(resultado), items: resultado });
});

const evidenciaInput = z.object({
  cumple: z.boolean().nullable().optional(),
  numero: z.string().trim().max(80).optional(),
  vence: dateInput.nullable().optional(),
  notas: z.string().trim().max(500).optional(),
});

/** Cargar o actualizar la evidencia manual de un ítem (sin archivo). */
cumplimientoRouter.put('/evidencias/:item', ADMIN, async (req, res) => {
  const d = evidenciaInput.parse(req.body);
  const update = { ...d };
  if (d.vence === null) update.$unset = { vence: 1 };
  const ev = await Evidencia.findOneAndUpdate({ item: req.params.item }, { $set: Object.fromEntries(Object.entries(update).filter(([k]) => !k.startsWith('$'))), ...(update.$unset && { $unset: update.$unset }) }, { new: true, upsert: true });
  res.json({ item: ev.item, estado: estadoEvidencia(ev) });
});

const subirEvidencia = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 16 * 1024 * 1024, files: 1 },
  fileFilter: (_r, f, cb) => cb(null, /^(image\/|application\/pdf)/.test(f.mimetype)),
});

/** Subir el archivo de evidencia (imagen o PDF, hasta 16 MB). */
cumplimientoRouter.post('/evidencias/:item/archivo', ADMIN, subirEvidencia.single('archivo'), async (req, res) => {
  if (!req.file) throw new HttpError(422, 'Adjuntá un archivo (imagen o PDF)');
  const url = await storage.save(req.file.buffer, { prefix: 'evidencias', mimetype: req.file.mimetype });
  const ev = await Evidencia.findOneAndUpdate({ item: req.params.item }, { $set: { archivoUrl: url, archivoNombre: req.file.originalname } }, { new: true, upsert: true });
  res.json({ item: ev.item, archivoUrl: url, archivoNombre: req.file.originalname, estado: estadoEvidencia(ev) });
});

/** Borrar la evidencia (vuelve a "sin cargar"). */
cumplimientoRouter.delete('/evidencias/:item', ADMIN, async (req, res) => {
  const r = await Evidencia.deleteOne({ item: req.params.item });
  if (!r.deletedCount) throw new HttpError(404, 'No encontrada');
  res.status(204).end();
});

// ---------- Autodiagnóstico ----------
/**
 * Grupos de preguntas del catálogo DIAG según el perfil. El estado de cada pregunta
 * se guarda como evidencia con id `diag-<id>`, sin archivo.
 */
cumplimientoRouter.get('/autodiagnostico', async (_req, res) => {
  const org = await Organization.findById(currentTenant()).lean();
  const perfil = perfilDe(org);
  const grupos = DIAG[perfil] ?? DIAG.cooperativa;
  const ids = grupos.flatMap((g) => g.items.map(([id]) => `diag-${id}`));
  const ev = new Map((await Evidencia.find({ item: { $in: ids } }).lean()).map((e) => [e.item, e]));
  const resultado = grupos.map((g) => ({
    grupo: g.g,
    items: g.items.map(([id, pregunta, ayuda]) => {
      const e = ev.get(`diag-${id}`);
      return { id, pregunta, ayuda, cumple: e?.cumple ?? null, notas: e?.notas ?? '' };
    }),
  }));
  const todos = resultado.flatMap((g) => g.items);
  const cumple = todos.filter((x) => x.cumple === true).length;
  const no = todos.filter((x) => x.cumple === false).length;
  res.json({ perfil, grupos: resultado, resumen: { cumple, no, sinResponder: todos.length - cumple - no, total: todos.length, pct: todos.length ? Math.round((cumple / todos.length) * 100) : 0 } });
});

cumplimientoRouter.put('/autodiagnostico/:id', ADMIN, async (req, res) => {
  const d = z.object({ cumple: z.boolean().nullable(), notas: z.string().trim().max(500).optional() }).parse(req.body);
  await Evidencia.findOneAndUpdate({ item: `diag-${req.params.id}` }, { $set: { cumple: d.cumple, ...(d.notas !== undefined && { notas: d.notas }) } }, { upsert: true });
  res.json({ id: req.params.id, ...d });
});
