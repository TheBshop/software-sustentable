// Proceso de planta: mapa, lotes, remitos y especificaciones de calidad por comprador.
import mongoose from 'mongoose';
import { Router } from 'express';
import { z } from 'zod';
import { Lote, Remito, ETAPAS_LOTE, fmtLote, fmtRemito } from './proceso.models.js';
import { clasificarLote, enfardarLote, venderLotes } from './lote.service.js';
import { tareasPendientes } from './rutinas.js';
import { renderRemitoPdf } from './remito.pdf.js';
import { Solicitud } from '../logistica/solicitud.model.js';
import { Pickup } from '../pickups/pickup.model.js';
import { Organization } from '../organizations/organization.model.js';
import { enTransaccion } from '../../lib/transacciones.js';
import { tenantPlugin, currentTenant } from '../../lib/tenancy.js';
import { crudRouter } from '../../lib/crud.js';
import { objectId, dateInput, round2 } from '../../lib/validation.js';
import { requireRole } from '../../middleware/auth.js';
import { HttpError } from '../../middleware/error.js';

const DIA = 86400000;
const GESTIONA = requireRole('administracion', 'operador_planta');

// ---------- Mapa del proceso ----------
export const procesoRouter = Router();

procesoRouter.get('/', async (_req, res) => {
  const [porEtapa, pedidos, sinPesar, pendientesHoy, viejos] = await Promise.all([
    Lote.aggregate([{ $match: { etapa: { $in: ['recepcion', 'clasificado', 'enfardado'] } } }, { $group: { _id: '$etapa', lotes: { $sum: 1 }, kg: { $sum: '$kg' } } }]),
    Solicitud.countDocuments({ estado: 'pendiente' }),
    Pickup.countDocuments({ estado: 'registrado' }),
    tareasPendientes('d'),
    Lote.countDocuments({ etapa: { $in: ['recepcion', 'clasificado', 'enfardado'] }, fecha: { $lt: new Date(Date.now() - 30 * DIA) } }),
  ]);
  const e = Object.fromEntries(porEtapa.map((x) => [x._id, { lotes: x.lotes, kg: round2(x.kg) }]));
  const vacio = { lotes: 0, kg: 0 };
  res.json({
    etapas: [
      { id: 'pedidos', label: 'Pedidos de retiro', cantidad: pedidos, link: '/operacion/agenda' },
      { id: 'retiros', label: 'Retiros sin pesar', cantidad: sinPesar, link: '/operacion/retiros' },
      { id: 'recepcion', label: 'Recepción', ...(e.recepcion ?? vacio), link: '/operacion/proceso?etapa=recepcion' },
      { id: 'clasificado', label: 'Clasificado', ...(e.clasificado ?? vacio), link: '/operacion/proceso?etapa=clasificado' },
      { id: 'enfardado', label: 'Listo para vender', ...(e.enfardado ?? vacio), link: '/operacion/proceso?etapa=enfardado' },
    ],
    avisos: [
      ...(pendientesHoy.length ? [{ tono: 'sun', texto: `${pendientesHoy.length} ${pendientesHoy.length === 1 ? 'tarea diaria' : 'tareas diarias'} sin marcar hoy`, link: '/operacion/rutinas' }] : []),
      ...(viejos ? [{ tono: 'sun', texto: `${viejos} ${viejos === 1 ? 'lote abierto' : 'lotes abiertos'} hace más de 30 días`, link: '/operacion/proceso' }] : []),
    ],
  });
});

// ---------- Lotes ----------
export const lotesRouter = Router();

lotesRouter.get('/', async (req, res) => {
  const { etapa, abiertos } = z.object({ etapa: z.enum(ETAPAS_LOTE).optional(), abiertos: z.enum(['true', 'false']).optional() }).parse(req.query);
  const filtro = etapa ? { etapa } : abiertos === 'false' ? {} : { etapa: { $in: ['recepcion', 'clasificado', 'enfardado'] } };
  const items = await Lote.find(filtro).sort({ numero: -1 }).limit(300).populate('material', 'nombre mezcla').populate('origen.cliente', 'razonSocial').populate('remito', 'numero').lean();
  res.json({ items: items.map((l) => ({ ...l, codigo: fmtLote(l.numero), pctRechazo: l.kgRechazo != null && l.kgIngreso ? round2((l.kgRechazo / l.kgIngreso) * 100) : null })) });
});

const clasificarInput = z.object({
  control: z.enum(['Apto', 'Húmedo', 'Mezclado', 'Contaminado']).optional(),
  humedad: z.number().min(0).max(100).optional(),
  kgSeparado: z.number().min(0).optional(),
  kgRechazo: z.number().min(0).optional(),
  causaRechazo: z.enum(['humedad', 'mezclado', 'contaminado', 'no_reciclable', 'otro']).optional(),
  items: z.array(z.object({ material: objectId, kg: z.number().positive() })).optional(),
});
lotesRouter.post('/:id/clasificar', GESTIONA, async (req, res) => {
  const d = clasificarInput.parse(req.body);
  res.json(await enTransaccion(() => clasificarLote(req.params.id, d, req.user.sub)));
});

lotesRouter.post('/:id/enfardar', GESTIONA, async (req, res) => {
  const d = z.object({ unidades: z.number().int().min(0).optional(), kgFinal: z.number().min(0) }).parse(req.body);
  res.json(await enTransaccion(() => enfardarLote(req.params.id, d, req.user.sub)));
});

const venderInput = z.object({
  comprador: objectId,
  fecha: dateInput.optional(),
  items: z.array(z.object({ lote: objectId, kg: z.number().positive(), precioKg: z.number().min(0) })).min(1),
  pesaje: z.enum(['Báscula', 'Estimado']).optional(),
  transporte: z.object({ razonSocial: z.string().max(160).optional(), patente: z.string().max(20).optional(), chofer: z.string().max(120).optional() }).optional(),
  observaciones: z.string().max(500).optional(),
});
lotesRouter.post('/vender', requireRole('administracion'), async (req, res) => {
  const d = venderInput.parse(req.body);
  const { venta, remito } = await enTransaccion(() => venderLotes(d, req.user.sub));
  res.status(201).json({ venta: { id: venta._id, total: venta.total }, remito: { id: remito._id, numero: remito.numero, codigo: fmtRemito(remito.numero) } });
});

// ---------- Remitos ----------
export const remitosRouter = Router();

remitosRouter.get('/', async (_req, res) => {
  const items = await Remito.find().sort({ numero: -1 }).limit(300).populate('destinatario', 'razonSocial cuit').populate('items.material', 'nombre').lean();
  res.json({ items: items.map((r) => ({ ...r, codigo: fmtRemito(r.numero), kg: round2(r.items.reduce((a, i) => a + i.kg, 0)) })) });
});

remitosRouter.get('/:id/pdf', async (req, res) => {
  const r = await Remito.findById(req.params.id).populate('destinatario').populate('items.material', 'nombre').populate('items.lote', 'numero');
  if (!r) throw new HttpError(404, 'Remito no encontrado');
  const org = await Organization.findById(currentTenant()).lean();
  res.type('application/pdf').setHeader('Content-Disposition', `inline; filename="remito-${fmtRemito(r.numero)}.pdf"`);
  renderRemitoPdf(r, org, res);
});

// Un remito no se borra (la numeración no tiene saltos): se anula con su motivo.
remitosRouter.post('/:id/anular', requireRole('administracion'), async (req, res) => {
  const { motivo } = z.object({ motivo: z.string().trim().min(3).max(300) }).parse(req.body);
  const r = await Remito.findById(req.params.id);
  if (!r) throw new HttpError(404, 'Remito no encontrado');
  if (r.anulado) throw new HttpError(409, 'El remito ya está anulado');
  r.set({ anulado: true, motivoAnulacion: motivo });
  await r.save();
  res.json({ id: r._id, anulado: true });
});

// ---------- Especificaciones de calidad por material y comprador ----------
const especSchema = new mongoose.Schema(
  {
    material: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
    comprador: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
    humedadMax: Number,
    impurezasMax: Number,
    presentacion: String,
    activo: { type: Boolean, default: true },
  },
  { timestamps: true },
);
especSchema.plugin(tenantPlugin);
export const EspecCalidad = mongoose.model('EspecCalidad', especSchema);
const especInput = z.object({
  material: objectId,
  comprador: objectId.optional(),
  humedadMax: z.number().min(0).max(100).optional(),
  impurezasMax: z.number().min(0).max(100).optional(),
  presentacion: z.string().trim().max(160).optional(),
});
export const calidadRouter = crudRouter(EspecCalidad, { createSchema: especInput, sort: '-createdAt', populate: 'material comprador', writeRoles: ['administracion', 'operador_planta'] });
