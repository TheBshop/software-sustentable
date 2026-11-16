// Logística de retiros: pedidos de retiro, hoja de ruta del chofer, frecuencia sugerida por
// cliente e indicadores de los recorridos. Sin sensores ni servicios de mapas: el orden de
// visita usa la ubicación GPS que la app guardó en retiros anteriores de cada cliente.
import { Router } from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Solicitud, solicitudInput, programarInput, MOTIVOS_NO_REALIZADO } from './solicitud.model.js';
import { Pickup, pesoEfectivo } from '../pickups/pickup.model.js';
import { Client } from '../clients/client.model.js';
import { Organization } from '../organizations/organization.model.js';
import { Gasto } from '../finanzas/gasto.model.js';
import { User } from '../users/user.model.js';
import { requireRole } from '../../middleware/auth.js';
import { HttpError } from '../../middleware/error.js';
import { storage } from '../../lib/storage.js';
import { currentTenant } from '../../lib/tenancy.js';
import { parseLocalDate, endOfLocalDay, round2 } from '../../lib/validation.js';
import { mesInput } from '../productividad/productividad.models.js';

const DAY = 86_400_000;
const POPULATE = [
  { path: 'cliente', select: 'razonSocial direcciones contacto' },
  { path: 'chofer', select: 'nombre' },
  { path: 'pedidaPor', select: 'nombre' },
];
const hoyLocal = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const diaLocal = (d) => new Date(new Date(d).getTime() - 3 * 3600_000).toISOString().slice(0, 10);

// ---------- Pedidos de retiro ----------
export const solicitudesRouter = Router();

solicitudesRouter.get('/', async (req, res) => {
  const { estado } = z.object({ estado: z.string().optional() }).parse(req.query);
  const query = {};
  if (estado) query.estado = { $in: estado.split(',') };
  if (req.user.role === 'chofer') query.chofer = req.user.sub;
  const items = await Solicitud.find(query).sort({ estado: 1, fechaProgramada: 1, createdAt: -1 }).limit(300).populate(POPULATE);
  res.json({ items, motivos: MOTIVOS_NO_REALIZADO });
});

// Choferes de la cooperativa, para programar los pedidos
solicitudesRouter.get('/choferes', requireRole('administracion', 'operador_planta'), async (_req, res) => {
  res.json({ items: await User.find({ organizacion: currentTenant(), rol: 'chofer', activo: { $ne: false } }).select('nombre').sort('nombre') });
});

solicitudesRouter.post('/', requireRole('administracion', 'operador_planta'), async (req, res) => {
  const data = solicitudInput.parse(req.body);
  if (!(await Client.exists({ _id: data.cliente }))) throw new HttpError(404, 'Cliente no encontrado');
  const s = await Solicitud.create({ ...data, pedidaPor: req.user.sub, estado: data.fechaProgramada ? 'programada' : 'pendiente' });
  res.status(201).json(await s.populate(POPULATE));
});

// Programar (fecha y chofer), rechazar o cancelar
solicitudesRouter.patch('/:id', requireRole('administracion', 'operador_planta'), async (req, res) => {
  const data = programarInput.parse(req.body);
  const s = await Solicitud.findById(req.params.id);
  if (!s) throw new HttpError(404, 'Pedido no encontrado');
  if (['realizada', 'no_realizada'].includes(s.estado)) throw new HttpError(409, 'El pedido ya se visitó');
  if (data.chofer && !(await User.exists({ _id: data.chofer, organizacion: currentTenant(), rol: 'chofer' }))) throw new HttpError(422, 'El chofer no es de esta cooperativa');
  if (data.fechaProgramada !== undefined) s.fechaProgramada = data.fechaProgramada ?? undefined;
  if (data.chofer !== undefined) s.chofer = data.chofer ?? undefined;
  if (data.estado) {
    s.estado = data.estado;
    if (data.estado === 'rechazada') s.motivoRechazo = data.motivoRechazo;
  } else if (s.fechaProgramada) s.estado = 'programada';
  await s.save();
  res.json(await s.populate(POPULATE));
});

// Visita en la que no se pudo retirar (el retiro hecho se registra con POST /retiros y `solicitud`)
const subirFoto = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1 }, fileFilter: (_r, f, cb) => cb(null, /^image\/(jpeg|png|webp|heic)$/.test(f.mimetype)) });
solicitudesRouter.post('/:id/no-realizado', requireRole('chofer', 'operador_planta', 'administracion'), subirFoto.single('foto'), async (req, res) => {
  const { motivo, detalle } = z.object({ motivo: z.enum(Object.keys(MOTIVOS_NO_REALIZADO)), detalle: z.string().max(300).optional() }).parse(req.body);
  const s = await Solicitud.findById(req.params.id);
  if (!s) throw new HttpError(404, 'Pedido no encontrado');
  if (req.user.role === 'chofer' && s.chofer && String(s.chofer) !== req.user.sub) throw new HttpError(403, 'El pedido es de otro chofer');
  if (s.estado !== 'programada') throw new HttpError(409, 'Solo se informan pedidos programados');
  const fotoUrl = req.file ? await storage.save(req.file.buffer, { prefix: 'visitas', mimetype: req.file.mimetype }) : undefined;
  s.estado = 'no_realizada';
  s.resultado = { motivo, detalle, fotoUrl, fecha: new Date(), chofer: req.user.sub };
  await s.save();
  res.json(s);
});

/** Lo llama el alta de retiros antes de crear el retiro: el pedido tiene que existir y ser del mismo cliente. */
export async function validarSolicitudParaRetiro(solicitudId, clienteId) {
  const s = await Solicitud.findById(solicitudId);
  if (!s) throw new HttpError(422, 'El pedido de retiro no existe');
  if (String(s.cliente) !== String(clienteId)) throw new HttpError(422, 'El retiro es de otro cliente que el pedido');
  if (['cancelada', 'rechazada'].includes(s.estado)) throw new HttpError(422, 'El pedido de retiro fue cancelado');
  return s;
}

/** Deja el pedido como realizado con el retiro registrado. */
export async function cerrarSolicitudConRetiro(solicitudId, pickup) {
  const s = await validarSolicitudParaRetiro(solicitudId, pickup.cliente);
  s.estado = 'realizada';
  s.retiro = pickup._id;
  await s.save();
}

// ---------- Hoja de ruta ----------
const rad = (g) => (g * Math.PI) / 180;
function km(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** Última ubicación GPS conocida de cada cliente (de sus retiros anteriores). */
async function ubicaciones(clientes) {
  const filas = await Pickup.aggregate([
    { $match: { cliente: { $in: clientes.map((c) => new mongoose.Types.ObjectId(String(c))) }, 'ubicacion.lat': { $exists: true } } },
    { $sort: { fecha: -1 } },
    { $group: { _id: '$cliente', ubicacion: { $first: '$ubicacion' } } },
  ]);
  return new Map(filas.map((f) => [String(f._id), f.ubicacion]));
}

/** Orden de visita: vecino más cercano desde la planta (o la primera parada con ubicación). */
export function ordenarParadas(paradas, inicio) {
  const con = paradas.filter((p) => p.ubicacion);
  const sin = paradas.filter((p) => !p.ubicacion);
  const orden = [];
  let actual = inicio ?? con[0]?.ubicacion;
  let totalKm = 0;
  const pendientes = [...con];
  while (pendientes.length) {
    let mejor = 0;
    for (let i = 1; i < pendientes.length; i++) if (km(actual, pendientes[i].ubicacion) < km(actual, pendientes[mejor].ubicacion)) mejor = i;
    const [p] = pendientes.splice(mejor, 1);
    const tramo = km(actual, p.ubicacion);
    totalKm += tramo;
    orden.push({ ...p, tramoKm: round2(tramo) });
    actual = p.ubicacion;
  }
  return { paradas: [...orden, ...sin.map((p) => ({ ...p, tramoKm: null }))], kmEstimados: round2(totalKm) };
}

export const hojaDeRutaRouter = Router();
hojaDeRutaRouter.get('/', async (req, res) => {
  const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(hoyLocal()).parse(req.query.fecha);
  const query = { estado: { $in: ['programada', 'realizada', 'no_realizada'] }, fechaProgramada: { $gte: parseLocalDate(fecha), $lte: endOfLocalDay(fecha) } };
  if (req.user.role === 'chofer') query.$or = [{ chofer: req.user.sub }, { chofer: { $exists: false } }];
  else if (typeof req.query.chofer === 'string' && req.query.chofer) query.chofer = req.query.chofer;
  const solicitudes = await Solicitud.find(query).populate(POPULATE);
  const ubic = await ubicaciones(solicitudes.map((s) => s.cliente._id));
  const org = await Organization.findById(currentTenant()).select('planta');
  const { paradas, kmEstimados } = ordenarParadas(
    solicitudes.map((s) => ({
      id: s._id,
      estado: s.estado,
      cliente: { id: s.cliente._id, razonSocial: s.cliente.razonSocial, telefono: s.cliente.contacto?.telefono },
      sede: s.sede ?? s.cliente.direcciones?.[0]?.direccion,
      detalle: s.detalle,
      kgEstimados: s.kgEstimados,
      chofer: s.chofer?.nombre,
      resultado: s.resultado?.motivo ? { ...s.resultado.toObject(), motivoTexto: MOTIVOS_NO_REALIZADO[s.resultado.motivo] } : null,
      retiro: s.retiro,
      ubicacion: ubic.get(String(s.cliente._id)) ?? null,
    })),
    org?.planta?.ubicacion?.lat ? org.planta.ubicacion : null,
  );
  res.json({ fecha, paradas, kmEstimados, sinUbicacion: paradas.filter((p) => !p.ubicacion).length });
});

// ---------- Frecuencia sugerida ----------
/**
 * Para cada generador con al menos 3 retiros en los últimos 120 días: cada cuántos días
 * conviene volver y cuándo toca el próximo. Si la cooperativa fijó una carga objetivo por
 * retiro (kg), el intervalo se calcula para llegar a esa carga; si no, se usa el intervalo
 * promedio que viene teniendo.
 */
export async function frecuenciaSugerida() {
  const desde = new Date(Date.now() - 120 * DAY);
  const [retiros, org, abiertos] = await Promise.all([
    Pickup.find({ fecha: { $gte: desde }, estado: { $ne: 'anulado' } }).select('cliente fecha items').populate('cliente', 'razonSocial tipo activo direcciones'),
    Organization.findById(currentTenant()).select('planta'),
    Solicitud.find({ estado: { $in: ['pendiente', 'programada'] } }).select('cliente estado fechaProgramada'),
  ]);
  const objetivo = org?.planta?.kgObjetivoRetiro ?? null;
  const conPedido = new Map(abiertos.map((s) => [String(s.cliente), s]));
  const porCliente = new Map();
  for (const r of retiros) {
    if (!r.cliente || r.cliente.tipo === 'comprador' || r.cliente.activo === false) continue;
    const k = String(r.cliente._id);
    const c = porCliente.get(k) ?? { cliente: r.cliente, fechas: [], kg: 0 };
    c.fechas.push(r.fecha.getTime());
    c.kg += r.items.reduce((a, it) => a + pesoEfectivo(it), 0);
    porCliente.set(k, c);
  }
  const hoy = parseLocalDate(hoyLocal()).getTime();
  return [...porCliente.values()]
    .filter((c) => new Set(c.fechas.map((f) => diaLocal(f))).size >= 3)
    .map((c) => {
      const fechas = c.fechas.sort((a, b) => a - b);
      const n = fechas.length;
      const intervalo = (fechas[n - 1] - fechas[0]) / DAY / (n - 1);
      const kgPorRetiro = c.kg / n;
      const kgPorDia = intervalo > 0 ? kgPorRetiro / intervalo : null;
      const sugerido = Math.max(1, Math.round(objetivo && kgPorDia ? objetivo / kgPorDia : intervalo));
      const proximo = parseLocalDate(diaLocal(fechas[n - 1])).getTime() + sugerido * DAY;
      const dias = Math.round((proximo - hoy) / DAY);
      const pedido = conPedido.get(String(c.cliente._id));
      return {
        cliente: { id: c.cliente._id, razonSocial: c.cliente.razonSocial, sede: c.cliente.direcciones?.[0]?.direccion },
        retiros: n,
        kgPorRetiro: round2(kgPorRetiro),
        kgPorDia: kgPorDia == null ? null : round2(kgPorDia),
        intervaloActualDias: round2(intervalo),
        intervaloSugeridoDias: sugerido,
        ultimoRetiro: new Date(fechas[n - 1]),
        proximo: new Date(proximo),
        estado: pedido ? 'con_pedido' : dias < 0 ? 'atrasado' : dias <= 1 ? 'toca' : 'al_dia',
        diasParaProximo: dias,
      };
    })
    .sort((a, b) => a.proximo - b.proximo);
}
solicitudesRouter.get('/sugeridos', requireRole('administracion', 'operador_planta'), async (_req, res) => {
  const org = await Organization.findById(currentTenant()).select('planta');
  res.json({ kgObjetivoRetiro: org?.planta?.kgObjetivoRetiro ?? null, items: await frecuenciaSugerida() });
});

// ---------- Indicadores de los recorridos ----------
export const logisticaRouter = Router();
logisticaRouter.get('/', requireRole('administracion', 'operador_planta'), async (req, res) => {
  const mes = mesInput.default(hoyLocal().slice(0, 7)).parse(req.query.mes);
  const [y, m] = mes.split('-').map(Number);
  const desde = parseLocalDate(`${mes}-01`);
  const hasta = endOfLocalDay(`${mes}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`);
  const fecha = { $gte: desde, $lte: hasta };
  const [retiros, combustible, solicitudes] = await Promise.all([
    Pickup.find({ fecha, estado: { $ne: 'anulado' } }).populate('chofer', 'nombre'),
    Gasto.aggregate([{ $match: { fecha, categoria: 'combustible' } }, { $group: { _id: null, monto: { $sum: '$monto' } } }]),
    Solicitud.find({ fechaProgramada: fecha, estado: { $in: ['realizada', 'no_realizada', 'programada'] } }),
  ]);
  const kg = retiros.reduce((a, r) => a + r.items.reduce((b, it) => b + pesoEfectivo(it), 0), 0);
  const dias = new Set(retiros.map((r) => diaLocal(r.fecha))).size;
  const choferes = new Map();
  for (const r of retiros) {
    const k = r.chofer?.nombre ?? 'Sin chofer';
    const c = choferes.get(k) ?? { chofer: k, retiros: 0, kg: 0 };
    c.retiros += 1;
    c.kg += r.items.reduce((b, it) => b + pesoEfectivo(it), 0);
    choferes.set(k, c);
  }
  const gastoCombustible = combustible[0]?.monto ?? 0;
  const visitadas = solicitudes.filter((s) => s.estado !== 'programada');
  const fallidas = solicitudes.filter((s) => s.estado === 'no_realizada');
  const motivos = {};
  for (const s of fallidas) motivos[s.resultado?.motivo ?? 'otro'] = (motivos[s.resultado?.motivo ?? 'otro'] ?? 0) + 1;
  res.json({
    mes,
    retiros: retiros.length,
    kg: round2(kg),
    diasConRetiros: dias,
    retirosPorDia: dias ? round2(retiros.length / dias) : null,
    kgPorRetiro: retiros.length ? round2(kg / retiros.length) : null,
    gastoCombustible: round2(gastoCombustible),
    combustiblePorTonelada: kg ? round2(gastoCombustible / (kg / 1000)) : null,
    pedidos: { programados: solicitudes.length, visitados: visitadas.length, noRealizados: fallidas.length, cumplimiento: visitadas.length ? round2(((visitadas.length - fallidas.length) / visitadas.length) * 100) : null, motivos },
    porChofer: [...choferes.values()].map((c) => ({ ...c, kg: round2(c.kg), kgPorRetiro: round2(c.kg / c.retiros) })).sort((a, b) => b.kg - a.kg),
    motivosTexto: MOTIVOS_NO_REALIZADO,
  });
});

// Carga objetivo por retiro (para la frecuencia sugerida) y ubicación de la planta (orden de visita)
logisticaRouter.patch('/configuracion', requireRole(), async (req, res) => {
  const data = z.object({ kgObjetivoRetiro: z.number().positive().max(100000).nullable().optional(), ubicacion: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).nullable().optional() }).parse(req.body);
  const org = await Organization.findById(currentTenant());
  if (data.kgObjetivoRetiro !== undefined) org.set('planta.kgObjetivoRetiro', data.kgObjetivoRetiro ?? undefined);
  if (data.ubicacion !== undefined) org.set('planta.ubicacion', data.ubicacion ?? undefined);
  await org.save();
  res.json({ planta: org.planta });
});

