import { Router } from 'express';
import { z } from 'zod';
import { Pickup } from '../pickups/pickup.model.js';
import { Certificate } from '../certificates/certificate.model.js';
import { Invoice } from '../invoices/invoice.model.js';
import { Organization } from '../organizations/organization.model.js';
import { renderCertificatePdf } from '../certificates/certificate.pdf.js';
import { clientesDeOrganizacion, resumenAnual, rangoAnio, nombresCooperativas } from './portal.service.js';
import { renderInformeAnual } from './informe.pdf.js';
import { requireGenerador } from '../../middleware/auth.js';
import { HttpError } from '../../middleware/error.js';
import { runWithoutTenant } from '../../lib/tenancy.js';
import { enviarDocumento } from '../pickups/pickup.routes.js';
import { clasificadorRouter } from '../normativa/clasificador.js';
import { datosConstancia, renderConstanciaPdf } from '../certificates/constancia.js';
import { Solicitud, MOTIVOS_NO_REALIZADO } from '../logistica/solicitud.model.js';
import { Client } from '../clients/client.model.js';
import { dateInput, objectId } from '../../lib/validation.js';

// Portal de clientes generadores (empresas y municipios): /api/v1/portal
// Solo lectura de SUS datos, en todas las cooperativas que los atienden. Nunca expone
// tarifas, otros clientes ni datos internos de la cooperativa.
export const portalRouter = Router();
portalRouter.use(requireGenerador());
portalRouter.use((_req, _res, next) => runWithoutTenant(next));

const anioActual = () => new Date().getFullYear();
const anioInput = z.coerce.number().int().min(2000).max(2100);

/** Ids de los registros Client de la organización; se cachea en el request. */
async function misClientes(req) {
  req._clientes ??= await clientesDeOrganizacion(req.user.org);
  return req._clientes.map((c) => c._id);
}

// Clasificador de residuos: el municipio y las empresas generadoras también lo usan
portalRouter.use('/clasificador', clasificadorRouter);

portalRouter.get('/organizacion', async (req, res) => {
  const org = await Organization.findById(req.user.org).select('nombre cuit tipo');
  const clientes = await clientesDeOrganizacion(req.user.org);
  const coops = await nombresCooperativas(clientes.map((c) => c.coop));
  res.json({
    ...org.toJSON(),
    cooperativas: [...coops.values()],
    sedes: clientes.flatMap((c) => c.direcciones.map((d) => d.alias ?? d.direccion)),
    // Un servicio por cooperativa que la atiende (para pedir retiros)
    servicios: clientes.map((c) => ({ cliente: c._id, cooperativa: coops.get(String(c.coop)), sedes: c.direcciones.map((d) => (d.alias ? `${d.alias} — ${d.direccion}` : d.direccion)) })),
  });
});

portalRouter.get('/resumen', async (req, res) => {
  const anio = anioInput.default(anioActual()).parse(req.query.anio);
  res.json(await resumenAnual(req.user.org, anio));
});

portalRouter.get('/retiros', async (req, res) => {
  const anio = anioInput.default(anioActual()).parse(req.query.anio);
  const { desde, hasta } = rangoAnio(anio);
  const retiros = await Pickup.find({ cliente: { $in: await misClientes(req) }, fecha: { $gte: desde, $lte: hasta } })
    .sort('-fecha')
    .limit(500)
    .populate('items.material', 'nombre fraccion corriente');
  const coops = await nombresCooperativas(retiros.map((r) => r.coop));
  res.json({
    items: retiros.map((r) => ({
      id: r._id,
      numero: r.numero,
      fecha: r.fecha,
      sede: r.direccion,
      cooperativa: coops.get(String(r.coop)),
      estado: r.estado,
      pesado: r.items.every((i) => i.pesoRealKg != null),
      materiales: r.items.map((i) => ({ nombre: i.material?.nombre, fraccion: i.material?.fraccion, corriente: i.material?.corriente, kg: i.pesoRealKg ?? i.pesoEstimadoKg })),
      certificado: r.certificado,
      documentos: r.documentos.map((d) => ({ id: d._id, tipo: d.tipo, numero: d.numero, nombre: d.nombre })),
    })),
  });
});

portalRouter.get('/retiros/:id/documentos/:docId', async (req, res) => {
  const retiro = await Pickup.findOne({ _id: req.params.id, cliente: { $in: await misClientes(req) } });
  const doc = retiro?.documentos.id(req.params.docId);
  if (!doc) throw new HttpError(404, 'Documento no encontrado');
  await enviarDocumento(res, doc);
});

// ---- Pedidos de retiro ----
portalRouter.get('/solicitudes', async (req, res) => {
  const items = await Solicitud.find({ cliente: { $in: await misClientes(req) } }).sort('-createdAt').limit(100);
  const coops = await nombresCooperativas(items.map((s) => s.coop));
  res.json({
    items: items.map((s) => ({
      id: s._id,
      cooperativa: coops.get(String(s.coop)),
      sede: s.sede,
      detalle: s.detalle,
      kgEstimados: s.kgEstimados,
      fechaPreferida: s.fechaPreferida,
      estado: s.estado,
      fechaProgramada: s.fechaProgramada,
      motivoRechazo: s.motivoRechazo,
      noRealizado: s.resultado?.motivo ? MOTIVOS_NO_REALIZADO[s.resultado.motivo] : null,
      creado: s.createdAt,
    })),
  });
});

portalRouter.post('/solicitudes', async (req, res) => {
  const data = z.object({ cliente: objectId, sede: z.string().max(200).optional(), detalle: z.string().min(2).max(500), kgEstimados: z.number().min(0).max(100000).optional(), fechaPreferida: dateInput.optional() }).parse(req.body);
  if (!(await misClientes(req)).some((id) => String(id) === data.cliente)) throw new HttpError(404, 'No encontramos ese servicio');
  const cliente = await Client.findById(data.cliente).select('coop');
  const s = await Solicitud.create({ ...data, coop: cliente.coop, origen: 'portal', pedidaPor: req.user.sub, estado: 'pendiente' });
  res.status(201).json({ id: s._id, estado: s.estado });
});

portalRouter.post('/solicitudes/:id/cancelar', async (req, res) => {
  const s = await Solicitud.findOne({ _id: req.params.id, cliente: { $in: await misClientes(req) } });
  if (!s) throw new HttpError(404, 'Pedido no encontrado');
  if (!['pendiente', 'programada'].includes(s.estado)) throw new HttpError(409, 'El pedido ya no se puede cancelar');
  s.estado = 'cancelada';
  await s.save();
  res.json({ id: s._id, estado: s.estado });
});

portalRouter.get('/certificados', async (req, res) => {
  const certs = await Certificate.find({ cliente: { $in: await misClientes(req) } }).sort('-fechaRetiro').limit(500);
  res.json({
    items: certs.map((c) => ({
      id: c._id,
      numero: c.numero,
      codigo: c.codigo,
      fechaRetiro: c.fechaRetiro,
      emisor: c.emisorSnapshot?.nombre,
      totalKg: c.totalKg,
      co2EvitadoKg: c.co2EvitadoKg,
      anulado: c.anulado,
    })),
  });
});

portalRouter.get('/certificados/:id/pdf', async (req, res) => {
  const cert = await Certificate.findOne({ _id: req.params.id, cliente: { $in: await misClientes(req) } });
  if (!cert) throw new HttpError(404, 'Certificado no encontrado');
  res.type('application/pdf').setHeader('Content-Disposition', `attachment; filename="certificado-${cert.numero}.pdf"`);
  await renderCertificatePdf(cert, res, { mostrarCosto: true });
});

portalRouter.get('/facturas', async (req, res) => {
  const facturas = await Invoice.find({ cliente: { $in: await misClientes(req) }, estado: { $ne: 'anulada' } }).sort('-emitidaEn').limit(200);
  const coops = await nombresCooperativas(facturas.map((f) => f.coop));
  res.json({
    items: facturas.map((f) => ({
      id: f._id,
      numero: f.numero,
      cooperativa: coops.get(String(f.coop)),
      periodo: f.periodo,
      emitidaEn: f.emitidaEn,
      vencimiento: f.vencimiento,
      estado: f.estado,
      vencida: f.vencida,
      total: f.total,
      saldo: f.saldo,
      lineas: f.lineas,
      detalle: f.detalle,
      comprobanteFiscal: f.comprobanteFiscal?.numero ? f.comprobanteFiscal : null,
    })),
  });
});

// Constancias anuales de reciclado: una por cada cooperativa que atiende a la organización.
portalRouter.get('/constancias', async (req, res) => {
  const anio = anioInput.default(anioActual()).parse(req.query.anio);
  const clientes = await clientesDeOrganizacion(req.user.org);
  const items = [];
  for (const c of clientes) {
    const d = await datosConstancia(c._id, anio, { sinTenant: true });
    if (d.retiros) items.push({ cliente: c._id, cooperativa: d.emisor?.nombre, razonSocial: c.razonSocial, kg: d.total, retiros: d.retiros, porTratamiento: d.porTratamiento });
  }
  res.json({ anio, items });
});

portalRouter.get('/constancias/:cliente.pdf', async (req, res) => {
  const anio = anioInput.default(anioActual()).parse(req.query.anio);
  if (!(await misClientes(req)).some((id) => String(id) === req.params.cliente)) throw new HttpError(404, 'Constancia no encontrada');
  const d = await datosConstancia(req.params.cliente, anio, { sinTenant: true });
  res.type('application/pdf').setHeader('Content-Disposition', `attachment; filename="constancia-reciclado-${anio}.pdf"`);
  await renderConstanciaPdf(d, res);
});

portalRouter.get('/informe-anual.pdf', async (req, res) => {
  const anio = anioInput.default(anioActual()).parse(req.query.anio);
  const org = await Organization.findById(req.user.org).select('nombre cuit tipo');
  const resumen = await resumenAnual(req.user.org, anio);
  res.type('application/pdf').setHeader('Content-Disposition', `attachment; filename="informe-residuos-${anio}.pdf"`);
  renderInformeAnual(org, resumen, res);
});
