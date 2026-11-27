import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import QRCode from 'qrcode';
import { ProductoReciclado, ETAPAS } from './trazabilidad.model.js';
import { calcularHuella, FACTORES_HUELLA, TIPOS_MATERIAL } from './huella.js';
import { HttpError } from '../../middleware/error.js';
import { env } from '../../config/env.js';

// ---- Schemas de validación ----

const ubicacionZ = z.object({
  direccion: z.string().optional(),
  ciudad: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
}).optional();

const generadorZ = z.object({
  nombre: z.string().optional(),
  cuit: z.string().optional(),
  direccion: z.string().optional(),
  ciudad: z.string().optional(),
}).optional();

const transportistaZ = z.object({
  nombre: z.string().optional(),
  patente: z.string().optional(),
  habilitacion: z.string().optional(),
}).optional();

const loteZ = z.object({
  tipo: z.enum(TIPOS_MATERIAL),
  pesoKg: z.number().positive(),
  descripcion: z.string().optional(),
  estadoFisico: z.enum(['solido', 'liquido', 'pastoso', 'gaseoso']).optional(),
  peligroso: z.boolean().optional(),
  caracteristicasPeligrosidad: z.string().optional(),
  origenTipo: z.enum(['recoleccion_domiciliaria', 'punto_verde', 'gran_generador', 'recolector_urbano', 'otro']).optional(),
  origenDetalle: z.string().optional(),
  generador: generadorZ,
  transportista: transportistaZ,
  fechaRecoleccion: z.string().optional(),
  fechaRecepcion: z.string().optional(),
  procesoTransformacion: z.string().optional(),
});

const eventoZ = z.object({
  etapa: z.enum(ETAPAS),
  fecha: z.string().optional(),
  ubicacion: ubicacionZ,
  observaciones: z.string().optional(),
  evidencia: z.string().optional(),
});

// ---- Helper: crear evento de auditoría ----

function crearEvento(data, req) {
  return {
    etapa: data.etapa,
    fecha: data.fecha ? new Date(data.fecha) : new Date(),
    responsable: req.user.sub,
    responsableNombre: req.user.nombre ?? req.user.email,
    ubicacion: data.ubicacion,
    observaciones: data.observaciones,
    evidencia: data.evidencia,
  };
}

// ---- Rutas autenticadas (cooperativa) ----

export const trazabilidadRouter = Router();

// Listar productos
trazabilidadRouter.get('/', async (req, res) => {
  const { estado } = req.query;
  const filter = {};
  if (estado) filter.estado = estado;
  const items = await ProductoReciclado.find(filter).sort('-createdAt').limit(200).lean();
  res.json({ items });
});

// Crear producto
trazabilidadRouter.post('/', async (req, res) => {
  const data = z.object({
    nombre: z.string().min(1),
    descripcion: z.string().optional(),
    categoria: z.enum(['ecoladrillo', 'maceta', 'bloque', 'compost', 'mobiliario', 'textil', 'otro']).optional(),
    lotes: z.array(loteZ).optional(),
  }).parse(req.body);

  const qrToken = crypto.randomBytes(12).toString('base64url');
  const lotes = (data.lotes ?? []).map((l) => {
    const huella = calcularHuella([l]);
    const lote = {
      ...l,
      fechaRecoleccion: l.fechaRecoleccion ? new Date(l.fechaRecoleccion) : new Date(),
      fechaRecepcion: l.fechaRecepcion ? new Date(l.fechaRecepcion) : undefined,
      co2EvitadoKg: huella.co2EvitadoKg,
      aguaEvitadaL: huella.aguaEvitadaL,
      eventos: [crearEvento({ etapa: 'generacion', observaciones: `Lote registrado: ${FACTORES_HUELLA[l.tipo]?.label} ${l.pesoKg} kg` }, req)],
    };
    if (l.fechaRecoleccion) {
      lote.eventos.push(crearEvento({ etapa: 'recoleccion', fecha: l.fechaRecoleccion, observaciones: `Recolección ${l.origenTipo?.replace(/_/g, ' ') ?? ''}`.trim() }, req));
    }
    return lote;
  });

  const totales = recalcularTotales(lotes);

  const doc = await ProductoReciclado.create({
    ...data,
    lotes,
    qrToken,
    ...totales,
    eventos: [crearEvento({ etapa: 'generacion', observaciones: `Producto creado: ${data.nombre}` }, req)],
  });

  res.status(201).json(doc);
});

// Obtener producto con toda la cadena de custodia
trazabilidadRouter.get('/:id', async (req, res) => {
  const doc = await ProductoReciclado.findById(req.params.id).lean();
  if (!doc) throw new HttpError(404, 'Producto no encontrado');
  res.json(doc);
});

// Agregar lotes a un producto
trazabilidadRouter.post('/:id/lotes', async (req, res) => {
  const nuevos = z.array(loteZ).min(1).parse(req.body);
  const doc = await ProductoReciclado.findById(req.params.id);
  if (!doc) throw new HttpError(404, 'Producto no encontrado');

  for (const l of nuevos) {
    const huella = calcularHuella([l]);
    const lote = {
      ...l,
      fechaRecoleccion: l.fechaRecoleccion ? new Date(l.fechaRecoleccion) : new Date(),
      fechaRecepcion: l.fechaRecepcion ? new Date(l.fechaRecepcion) : undefined,
      co2EvitadoKg: huella.co2EvitadoKg,
      aguaEvitadaL: huella.aguaEvitadaL,
      eventos: [crearEvento({ etapa: 'generacion', observaciones: `Lote agregado: ${FACTORES_HUELLA[l.tipo]?.label} ${l.pesoKg} kg` }, req)],
    };
    doc.lotes.push(lote);
  }

  Object.assign(doc, recalcularTotales(doc.lotes));
  doc.eventos.push(crearEvento({ etapa: 'transformacion', observaciones: `${nuevos.length} lote(s) agregado(s)` }, req));
  await doc.save();
  res.json(doc);
});

// Registrar evento de auditoría en un lote
trazabilidadRouter.post('/:id/lotes/:loteId/eventos', async (req, res) => {
  const data = eventoZ.parse(req.body);
  const doc = await ProductoReciclado.findById(req.params.id);
  if (!doc) throw new HttpError(404, 'Producto no encontrado');

  const lote = doc.lotes.id(req.params.loteId);
  if (!lote) throw new HttpError(404, 'Lote no encontrado');

  lote.eventos.push(crearEvento(data, req));

  if (data.etapa === 'recoleccion' && !lote.fechaRecoleccion) lote.fechaRecoleccion = new Date(data.fecha || Date.now());
  if (data.etapa === 'recepcion' && !lote.fechaRecepcion) lote.fechaRecepcion = new Date(data.fecha || Date.now());
  if (data.etapa === 'clasificacion' && !lote.fechaClasificacion) lote.fechaClasificacion = new Date(data.fecha || Date.now());
  if (data.etapa === 'transformacion' && !lote.fechaTransformacion) lote.fechaTransformacion = new Date(data.fecha || Date.now());

  await doc.save();
  res.json(doc);
});

// Registrar evento de auditoría general del producto
trazabilidadRouter.post('/:id/eventos', async (req, res) => {
  const data = eventoZ.parse(req.body);
  const doc = await ProductoReciclado.findById(req.params.id);
  if (!doc) throw new HttpError(404, 'Producto no encontrado');

  doc.eventos.push(crearEvento(data, req));
  await doc.save();
  res.json(doc);
});

// Cambiar estado (con registro de auditoría)
trazabilidadRouter.patch('/:id/estado', async (req, res) => {
  const { estado, entregadoANombre } = z.object({
    estado: z.enum(['en_produccion', 'disponible', 'entregado']),
    entregadoANombre: z.string().optional(),
  }).parse(req.body);

  const doc = await ProductoReciclado.findById(req.params.id);
  if (!doc) throw new HttpError(404, 'Producto no encontrado');

  doc.estado = estado;

  if (estado === 'disponible') {
    doc.certificadoPor = req.user.sub;
    doc.certificadoPorNombre = req.user.nombre ?? req.user.email;
    doc.fechaCertificacion = new Date();
    doc.eventos.push(crearEvento({ etapa: 'producto_final', observaciones: 'Producto certificado como disponible' }, req));
  }

  if (estado === 'entregado') {
    doc.fechaEntrega = new Date();
    if (entregadoANombre) doc.entregadoANombre = entregadoANombre;
    doc.eventos.push(crearEvento({ etapa: 'entrega', observaciones: `Entregado${entregadoANombre ? ` a ${entregadoANombre}` : ''}` }, req));
  }

  await doc.save();
  res.json(doc);
});

// Obtener historial de auditoría completo (producto + lotes) en orden cronológico
trazabilidadRouter.get('/:id/auditoria', async (req, res) => {
  const doc = await ProductoReciclado.findById(req.params.id).lean();
  if (!doc) throw new HttpError(404, 'Producto no encontrado');

  const eventos = [];
  for (const e of (doc.eventos ?? [])) {
    eventos.push({ ...e, contexto: 'producto', productoNombre: doc.nombre });
  }
  for (const lote of (doc.lotes ?? [])) {
    for (const e of (lote.eventos ?? [])) {
      eventos.push({ ...e, contexto: 'lote', loteId: lote._id, materialTipo: lote.tipo, materialLabel: FACTORES_HUELLA[lote.tipo]?.label ?? lote.tipo });
    }
  }
  eventos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  res.json({ producto: doc.nombre, eventos });
});

// Generar QR
trazabilidadRouter.get('/:id/qr', async (req, res) => {
  const doc = await ProductoReciclado.findById(req.params.id).lean();
  if (!doc) throw new HttpError(404, 'Producto no encontrado');
  const url = `${env.publicWebUrl}/trazabilidad/${doc.qrToken}`;
  const qrDataUrl = await QRCode.toDataURL(url, { width: 400, margin: 2 });
  res.json({ url, qr: qrDataUrl });
});

// Calculadora de huella
trazabilidadRouter.post('/calcular-huella', (req, res) => {
  const materiales = z.array(z.object({ tipo: z.enum(TIPOS_MATERIAL), pesoKg: z.number().positive() })).min(1).parse(req.body);
  res.json(calcularHuella(materiales));
});

// Factores disponibles
trazabilidadRouter.get('/factores/lista', (_req, res) => {
  res.json(FACTORES_HUELLA);
});

// Etapas disponibles
trazabilidadRouter.get('/etapas/lista', (_req, res) => {
  res.json({ etapas: ETAPAS, labels: {
    generacion: 'Generación del residuo',
    recoleccion: 'Recolección',
    transporte: 'Transporte',
    recepcion: 'Recepción en planta',
    clasificacion: 'Clasificación',
    transformacion: 'Transformación',
    producto_final: 'Producto final',
    entrega: 'Entrega',
  }});
});

// ---- Ruta pública (sin auth) ----

export const trazabilidadPublicaRouter = Router();

trazabilidadPublicaRouter.get('/:token', async (req, res) => {
  const doc = await ProductoReciclado.findOne({ qrToken: req.params.token })
    .populate('_coop', 'nombre cuit')
    .lean();

  if (!doc) throw new HttpError(404, 'Producto no encontrado');

  const todosEventos = [];
  for (const e of (doc.eventos ?? [])) {
    todosEventos.push({ ...e, contexto: 'producto' });
  }
  for (const lote of (doc.lotes ?? [])) {
    for (const e of (lote.eventos ?? [])) {
      todosEventos.push({ ...e, contexto: 'lote', materialLabel: FACTORES_HUELLA[lote.tipo]?.label ?? lote.tipo, pesoKg: lote.pesoKg });
    }
  }
  todosEventos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  res.json({
    nombre: doc.nombre,
    descripcion: doc.descripcion,
    categoria: doc.categoria,
    estado: doc.estado,
    cooperativa: doc._coop ? { nombre: doc._coop.nombre, cuit: doc._coop.cuit } : null,
    lotes: doc.lotes.map((l) => ({
      id: l._id,
      material: FACTORES_HUELLA[l.tipo]?.label ?? l.tipo,
      tipo: l.tipo,
      pesoKg: l.pesoKg,
      descripcion: l.descripcion,
      origen: l.origenTipo?.replace(/_/g, ' '),
      origenDetalle: l.origenDetalle,
      generador: l.generador,
      transportista: l.transportista ? { nombre: l.transportista.nombre, patente: l.transportista.patente } : null,
      fechaRecoleccion: l.fechaRecoleccion,
      fechaRecepcion: l.fechaRecepcion,
      procesoTransformacion: l.procesoTransformacion,
      co2EvitadoKg: l.co2EvitadoKg,
      aguaEvitadaL: l.aguaEvitadaL,
      eventos: (l.eventos ?? []).map((e) => ({
        etapa: e.etapa,
        fecha: e.fecha,
        responsableNombre: e.responsableNombre,
        ubicacion: e.ubicacion,
        observaciones: e.observaciones,
      })),
    })),
    cadena: todosEventos.map((e) => ({
      etapa: e.etapa,
      fecha: e.fecha,
      responsableNombre: e.responsableNombre,
      ubicacion: e.ubicacion,
      observaciones: e.observaciones,
      contexto: e.contexto,
      materialLabel: e.materialLabel,
      pesoKg: e.pesoKg,
    })),
    pesoTotalKg: doc.pesoTotalKg,
    co2EvitadoKg: doc.co2EvitadoKg,
    aguaEvitadaL: doc.aguaEvitadaL,
    certificadoPorNombre: doc.certificadoPorNombre,
    fechaCertificacion: doc.fechaCertificacion,
    fechaCreacion: doc.createdAt,
    fechaEntrega: doc.fechaEntrega,
  });
});

function recalcularTotales(lotes) {
  return {
    pesoTotalKg: lotes.reduce((s, l) => s + (l.pesoKg ?? 0), 0),
    co2EvitadoKg: lotes.reduce((s, l) => s + (l.co2EvitadoKg ?? 0), 0),
    aguaEvitadaL: lotes.reduce((s, l) => s + (l.aguaEvitadaL ?? 0), 0),
  };
}
