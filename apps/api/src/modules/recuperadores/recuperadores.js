// Recuperadores urbanos y compras de material: el registro (censo) de quienes le venden a la
// cooperativa y cada compra con su recibo. Cada compra entra al stock como un ingreso de
// origen "recuperador" (inclusión de recuperadores: guía BID de planes de inclusión; Ord. 9233
// de Paraná, arts. 34-35). Las compras pagadas son un egreso en el balance.
import mongoose from 'mongoose';
import PDFDocument from 'pdfkit';
import { Router } from 'express';
import { z } from 'zod';
import { tenantPlugin } from '../../lib/tenancy.js';
import { objectId, dateInput, round2, parseLocalDate, endOfLocalDay } from '../../lib/validation.js';
import { nextSeq } from '../../lib/counters.js';
import { requireRole } from '../../middleware/auth.js';
import { HttpError } from '../../middleware/error.js';
import { Intake } from '../plant/plant.models.js';
import { Organization } from '../organizations/organization.model.js';
import { currentTenant } from '../../lib/tenancy.js';
import { assertHabilitados, registrarIngreso } from '../movimientos/movimiento.service.js';
import { resolverPesos } from '../materials/unidades.js';
import { mesInput } from '../productividad/productividad.models.js';

const { ObjectId } = mongoose.Schema.Types;

const recuperadorSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    documento: { type: String, trim: true }, // DNI: opcional, solo si la persona lo da
    telefono: String,
    zona: String, // barrio o recorrido habitual
    vehiculo: { type: String, enum: ['a_pie', 'carro', 'bicicleta', 'moto', 'vehiculo'], default: 'carro' },
    asociado: { type: Boolean, default: false }, // socio/a de la cooperativa
    notas: String,
    activo: { type: Boolean, default: true },
  },
  { timestamps: true },
);
recuperadorSchema.plugin(tenantPlugin);
export const Recuperador = mongoose.model('Recuperador', recuperadorSchema);

export const recuperadorInput = z.object({
  nombre: z.string().min(2).max(120),
  documento: z.string().max(20).optional(),
  telefono: z.string().max(40).optional(),
  zona: z.string().max(120).optional(),
  vehiculo: z.enum(['a_pie', 'carro', 'bicicleta', 'moto', 'vehiculo']).optional(),
  asociado: z.boolean().optional(),
  notas: z.string().max(500).optional(),
  activo: z.boolean().optional(),
});

const compraSchema = new mongoose.Schema(
  {
    numero: Number,
    fecha: { type: Date, default: Date.now },
    recuperador: { type: ObjectId, ref: 'Recuperador', required: true },
    items: [{ _id: false, material: { type: ObjectId, ref: 'Material', required: true }, pesoKg: { type: Number, min: 0 }, precioKg: { type: Number, min: 0 }, cantidad: Number, unidad: String, estimado: Boolean }],
    total: Number,
    pagada: { type: Boolean, default: false },
    fechaPago: Date,
    medioPago: { type: String, enum: ['efectivo', 'transferencia', 'billetera', 'otro'] },
    ingreso: { type: ObjectId, ref: 'Intake' },
    usuario: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
compraSchema.pre('validate', function () {
  this.total = round2(this.items.reduce((a, i) => a + i.pesoKg * i.precioKg, 0));
});
compraSchema.plugin(tenantPlugin);
compraSchema.index({ coop: 1, numero: 1 }, { unique: true });
export const Compra = mongoose.model('Compra', compraSchema);

const compraInput = z.object({
  fecha: dateInput.optional(),
  recuperador: objectId,
  items: z
    .array(
      z
        .object({ material: objectId, pesoKg: z.number().min(0).optional(), cantidad: z.number().positive().optional(), unidad: z.string().max(30).optional(), precioKg: z.number().min(0) })
        .refine((i) => i.pesoKg != null || (i.cantidad != null && i.unidad), 'Indicá los kg o la cantidad y la unidad'),
    )
    .min(1),
  pagada: z.boolean().optional(),
  medioPago: z.enum(['efectivo', 'transferencia', 'billetera', 'otro']).optional(),
});

const POPULATE = [{ path: 'recuperador', select: 'nombre documento zona' }, { path: 'items.material', select: 'nombre codigo' }];

export const comprasRouter = Router();

comprasRouter.get('/', requireRole('administracion', 'operador_planta'), async (req, res) => {
  const query = {};
  if (typeof req.query.recuperador === 'string') query.recuperador = objectId.parse(req.query.recuperador);
  if (typeof req.query.mes === 'string') {
    const { desde, hasta } = rangoMes(mesInput.parse(req.query.mes));
    query.fecha = { $gte: desde, $lte: hasta };
  }
  res.json({ items: await Compra.find(query).sort('-fecha').limit(300).populate(POPULATE) });
});

// Registrar una compra: entra al stock como ingreso de recuperador
comprasRouter.post('/', requireRole('administracion', 'operador_planta'), async (req, res) => {
  const data = compraInput.parse(req.body);
  const rec = await Recuperador.findById(data.recuperador);
  if (!rec) throw new HttpError(404, 'Recuperador no encontrado');
  await assertHabilitados(data.items.map((i) => i.material));
  data.items = await resolverPesos(data.items, 'pesoKg');
  const fecha = data.fecha ?? new Date();
  const ingreso = await Intake.create({ fecha, origen: 'recuperador', detalleOrigen: `Compra a ${rec.nombre}`, items: data.items.map(({ material, pesoKg, cantidad, unidad, estimado }) => ({ material, pesoKg, cantidad, unidad, estimado })) });
  await registrarIngreso(ingreso, req.user.sub);
  const compra = await Compra.create({ ...data, fecha, numero: await nextSeq('compra'), ingreso: ingreso._id, usuario: req.user.sub, ...(data.pagada && { fechaPago: fecha }) });
  res.status(201).json(await compra.populate(POPULATE));
});

// Marcar pagada (las compras no se borran: ya movieron el stock)
comprasRouter.patch('/:id', requireRole('administracion'), async (req, res) => {
  const data = z.object({ pagada: z.boolean(), medioPago: z.enum(['efectivo', 'transferencia', 'billetera', 'otro']).optional() }).parse(req.body);
  const c = await Compra.findById(req.params.id);
  if (!c) throw new HttpError(404, 'Compra no encontrada');
  c.pagada = data.pagada;
  c.fechaPago = data.pagada ? new Date() : undefined;
  if (data.medioPago) c.medioPago = data.medioPago;
  await c.save();
  res.json(await c.populate(POPULATE));
});

const fmt = (n, d = 2) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: d });
const pesos = (n) => Number(n).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });

// Recibo para la persona que vendió el material
comprasRouter.get('/:id/recibo.pdf', requireRole('administracion', 'operador_planta'), async (req, res) => {
  const c = await Compra.findById(req.params.id).populate(POPULATE);
  if (!c) throw new HttpError(404, 'Compra no encontrada');
  const org = await Organization.findById(currentTenant()).select('nombre cuit');
  res.type('application/pdf').setHeader('Content-Disposition', `inline; filename="recibo-compra-${c.numero}.pdf"`);
  const doc = new PDFDocument({ size: 'A5', margin: 36 });
  doc.pipe(res);
  doc.fontSize(14).text(org?.nombre ?? 'Cooperativa').fontSize(9).fillColor('#555').text(org?.cuit ? `CUIT ${org.cuit}` : '');
  doc.moveDown().fillColor('black').fontSize(13).text(`Recibo de compra de material N° ${String(c.numero).padStart(6, '0')}`);
  doc.fontSize(10).text(`Fecha: ${c.fecha.toLocaleDateString('es-AR')}`);
  doc.text(`Vendió: ${c.recuperador?.nombre}${c.recuperador?.documento ? ` · DNI ${c.recuperador.documento}` : ''}`);
  doc.moveDown();
  for (const it of c.items) doc.text(`${it.material?.nombre}: ${fmt(it.pesoKg)} kg${it.estimado ? ' (estimado)' : ''} × ${pesos(it.precioKg)} = ${pesos(it.pesoKg * it.precioKg)}`);
  doc.moveDown().fontSize(12).text(`Total: ${pesos(c.total)}`);
  doc.fontSize(10).text(c.pagada ? `Pagado${c.medioPago ? ` (${c.medioPago})` : ''} el ${c.fechaPago?.toLocaleDateString('es-AR') ?? ''}` : 'Pendiente de pago');
  doc.moveDown(3).text('______________________            ______________________');
  doc.text('Firma de quien vende                    Firma de la cooperativa');
  doc.end();
});

function rangoMes(mes) {
  const [y, m] = mes.split('-').map(Number);
  return { desde: parseLocalDate(`${mes}-01`), hasta: endOfLocalDay(`${mes}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`) };
}

export const recuperadoresResumenRouter = Router();
// Lo comprado a cada recuperador en el mes: kg, monto, pagado y pendiente
recuperadoresResumenRouter.get('/resumen', requireRole('administracion', 'operador_planta'), async (req, res) => {
  const mes = mesInput.default(new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 7)).parse(req.query.mes);
  const { desde, hasta } = rangoMes(mes);
  const compras = await Compra.find({ fecha: { $gte: desde, $lte: hasta } }).populate('recuperador', 'nombre asociado');
  const por = new Map();
  for (const c of compras) {
    const k = String(c.recuperador?._id);
    const r = por.get(k) ?? { recuperador: c.recuperador?.nombre, asociado: c.recuperador?.asociado, compras: 0, kg: 0, monto: 0, pendiente: 0 };
    r.compras += 1;
    r.kg += c.items.reduce((a, i) => a + i.pesoKg, 0);
    r.monto += c.total;
    if (!c.pagada) r.pendiente += c.total;
    por.set(k, r);
  }
  const items = [...por.values()].map((r) => ({ ...r, kg: round2(r.kg), monto: round2(r.monto), pendiente: round2(r.pendiente), precioPromedioKg: r.kg ? round2(r.monto / r.kg) : null })).sort((a, b) => b.kg - a.kg);
  res.json({ mes, items, totales: { recuperadores: items.length, kg: round2(items.reduce((a, r) => a + r.kg, 0)), monto: round2(items.reduce((a, r) => a + r.monto, 0)), pendiente: round2(items.reduce((a, r) => a + r.pendiente, 0)) } });
});
