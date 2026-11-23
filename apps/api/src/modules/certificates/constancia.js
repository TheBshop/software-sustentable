// Constancia anual de reciclado: la cooperativa declara qué recibió de un generador en el año
// y qué tratamiento le dio. Sirve de respaldo a la declaración jurada del generador, que la
// Ley 25.612 exige firmada también por quien recicla (arts. 11 inc. e y 12), y documenta que
// el material pasó a ser insumo de otro proceso productivo (art. 43 inc. b).
// No reemplaza la declaración jurada ni los formularios de la autoridad provincial.
import mongoose from 'mongoose';
import PDFDocument from 'pdfkit';
import { Router } from 'express';
import { z } from 'zod';
import { Pickup } from '../pickups/pickup.model.js';
import { Client } from '../clients/client.model.js';
import { Organization } from '../organizations/organization.model.js';
import { TRATAMIENTOS } from '../materials/fracciones.js';
import { requireRole } from '../../middleware/auth.js';
import { HttpError } from '../../middleware/error.js';
import { leerArchivo } from '../../lib/storage.js';
import { parseLocalDate, endOfLocalDay, round2 } from '../../lib/validation.js';
import { regimenParaJurisdiccion, CODIGOS_VALORIZACION } from './regimenes-gg.js';

const VERDE = '#2f7d32';
const n = (v) => Number(v ?? 0).toLocaleString('es-AR', { maximumFractionDigits: 1 });
const CORTO = { reciclado: 'Reciclado', reuso: 'Reúso', compostaje: 'Compostaje', disposicion_final: 'Disposición final' };

export const anioInput = z.coerce.number().int().min(2000).max(2100);

/**
 * Kilos de un cliente en el año, por material y tratamiento.
 * `opciones`: { sinTenant: true } cuando se llama desde el portal (el cliente ya acota los datos).
 */
export async function datosConstancia(clienteId, anio, opciones = {}) {
  const cliente = await Client.findById(clienteId).setOptions(opciones).select('razonSocial cuit coop direcciones regimenGG');
  if (!cliente) throw new HttpError(404, 'Cliente no encontrado');
  const emisor = await Organization.findById(cliente.coop).select('nombre cuit certificado habilitaciones jurisdiccion');
  const filas = await Pickup.aggregate([
    {
      $match: {
        cliente: new mongoose.Types.ObjectId(String(clienteId)),
        estado: { $ne: 'anulado' },
        fecha: { $gte: parseLocalDate(`${anio}-01-01`), $lte: endOfLocalDay(`${anio}-12-31`) },
      },
    },
    { $unwind: '$items' },
    { $lookup: { from: 'materials', localField: 'items.material', foreignField: '_id', as: 'm' } },
    { $set: { m: { $first: '$m' }, real: { $ne: [{ $type: '$items.pesoRealKg' }, 'missing'] } } },
    {
      $group: {
        _id: { material: '$m.nombre', corriente: '$m.corriente', tratamiento: { $ifNull: ['$m.tratamiento', { $cond: [{ $eq: ['$m.valorizable', false] }, 'disposicion_final', 'reciclado'] }] } },
        kg: { $sum: { $ifNull: ['$items.pesoRealKg', '$items.pesoEstimadoKg'] } },
        kgEstimado: { $sum: { $cond: ['$real', 0, '$items.pesoEstimadoKg'] } },
        retiros: { $addToSet: '$_id' },
      },
    },
    { $sort: { kg: -1 } },
  ]).option(opciones);
  const materiales = filas.map((f) => ({ material: f._id.material, corriente: f._id.corriente, tratamiento: f._id.tratamiento, kg: round2(f.kg), kgEstimado: round2(f.kgEstimado) }));
  const total = round2(materiales.reduce((a, m) => a + m.kg, 0));
  const porTratamiento = Object.fromEntries(Object.keys(TRATAMIENTOS).map((t) => [t, round2(materiales.filter((m) => m.tratamiento === t).reduce((a, m) => a + m.kg, 0))]));
  const retiros = new Set(filas.flatMap((f) => f.retiros.map(String))).size;
  const regimen = regimenParaJurisdiccion(cliente.regimenGG?.jurisdiccion);
  return { anio, cliente, emisor, materiales, total, porTratamiento, retiros, regimen };
}

async function imagen(url) {
  if (!url) return null;
  try {
    return await leerArchivo(url);
  } catch {
    return null;
  }
}

export async function renderConstanciaPdf(d, stream) {
  const { anio, cliente, emisor, materiales, total, porTratamiento, retiros, regimen } = d;
  const gg = cliente.regimenGG ?? {};
  const cert = emisor?.certificado ?? {};
  const [firma, sello] = await Promise.all([imagen(cert.firmaUrl), imagen(cert.selloUrl)]);
  const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `Constancia de reciclado ${anio} · ${cliente.razonSocial}` } });
  doc.pipe(stream);
  const W = doc.page.width - 100;

  // ── Header verde ──────────────────────────────────────────────────────────
  doc.rect(0, 0, doc.page.width, 90).fill(VERDE);
  doc.fillColor('white').fontSize(18).text(emisor?.nombre ?? 'Cooperativa', 50, 26);
  doc.fontSize(10).text(emisor?.cuit ? `CUIT ${emisor.cuit}` : '', 50, 52);
  const registros = (emisor?.habilitaciones?.registros ?? []).filter((x) => !x.vence || x.vence >= new Date()).slice(0, 2);
  for (const [i, r] of registros.entries()) {
    doc.fontSize(8).text(`${r.descripcion} N° ${r.numero}`, 50, 66 + i * 10);
  }

  // ── Título ────────────────────────────────────────────────────────────────
  doc.fillColor('black').fontSize(16).text(`Constancia de recepción y reciclado de residuos · ${anio}`, 50, 115, { width: W, align: 'center' });

  // ── Bloque jurisdiccional (si hay régimen de GG configurado) ──────────────
  if (regimen) {
    doc.moveDown(0.6).fontSize(9).fillColor(VERDE).font('Helvetica-Bold');
    doc.text(`Régimen: ${regimen.nombre} — ${regimen.normaGG}`, 50, doc.y, { width: W });
    doc.font('Helvetica').fillColor('black');
    doc.moveDown(0.3).fontSize(10);
    const lineas = [];
    if (gg.nroRegistroGG) lineas.push(`N° registro del generador: ${gg.nroRegistroGG}`);
    if (gg.categoriaGG) lineas.push(`Categoría: ${gg.categoriaGG}`);
    if (gg.nroHabilitacionEspecial) lineas.push(`Hab. especial generador: ${gg.nroHabilitacionEspecial}`);
    // Datos del operador desde habilitaciones
    for (const co of regimen.camposOperador ?? []) {
      const val = emisor?.habilitaciones?.[co.campo];
      if (val) lineas.push(`${co.label}: ${val}`);
    }
    if (gg.codigoValorizacion) {
      const desc = CODIGOS_VALORIZACION[gg.codigoValorizacion] ?? '';
      lineas.push(`Operación de valorización: ${gg.codigoValorizacion}${desc ? ` — ${desc}` : ''}`);
    }
    if (gg.categoriaResiduoCABA) lineas.push(`Categoría residuo CABA: ${gg.categoriaResiduoCABA}`);
    if (gg.categoriaYA) lineas.push(`Categorías Y/A (Ley 11.720): ${gg.categoriaYA}`);
    if (gg.clasificacionResiduo) lineas.push(`Clasificación residuo: ${gg.clasificacionResiduo}`);
    if (lineas.length) {
      doc.rect(48, doc.y - 2, W + 4, lineas.length * 14 + 8).fillOpacity(0.05).fill(VERDE).fillOpacity(1).fillColor('black');
      for (const l of lineas) {
        doc.fontSize(9).text(l, 54, doc.y + 2, { width: W - 8 });
      }
    }
  }

  // ── Párrafo declarativo ───────────────────────────────────────────────────
  doc.moveDown(1.2).fontSize(11).fillColor('black');
  doc.text(
    `${emisor?.nombre ?? 'La cooperativa'} deja constancia de que durante el año ${anio} recibió de ${cliente.razonSocial}` +
      `${cliente.cuit ? ` (CUIT ${cliente.cuit})` : ''} ${n(total)} kg de residuos en ${retiros} retiro${retiros === 1 ? '' : 's'}, ` +
      'con el detalle y el tratamiento que se indican a continuación.',
    { width: W },
  );

  // ── Tabla de materiales ───────────────────────────────────────────────────
  let y = doc.y + 16;
  const cols = [50, 260, 400, 470];
  doc.font('Helvetica-Bold').fontSize(10).text('Material', cols[0], y).text('Tratamiento', cols[1], y).text('Kilos', cols[2], y).text('Estimado', cols[3], y);
  y += 16;
  doc.moveTo(50, y - 4).lineTo(50 + W, y - 4).strokeColor('#ccc').stroke();
  doc.font('Helvetica');
  for (const m of materiales) {
    if (y > doc.page.height - 230) {
      doc.addPage();
      y = 50;
    }
    doc.text(m.material ?? '—', cols[0], y, { width: 205 }).text(CORTO[m.tratamiento] ?? '—', cols[1], y).text(n(m.kg), cols[2], y).text(m.kgEstimado ? n(m.kgEstimado) : '—', cols[3], y);
    y += 16;
  }
  if (!materiales.length) {
    doc.fillColor('#555').text('No hubo retiros en el año.', cols[0], y).fillColor('black');
    y += 16;
  }
  doc.moveTo(50, y).lineTo(50 + W, y).stroke();
  y += 6;
  doc.font('Helvetica-Bold').text('Total', cols[0], y).text(n(total), cols[2], y).font('Helvetica');
  y += 22;

  // ── Resumen de valorización ───────────────────────────────────────────────
  const insumo = round2(porTratamiento.reciclado + porTratamiento.reuso + porTratamiento.compostaje);
  doc.fontSize(10).text(
    `Del total, ${n(insumo)} kg (${total ? n((insumo / total) * 100) : 0} %) se destinaron a reciclado, reúso o compostaje como insumo de otros procesos productivos, ` +
      `y ${n(porTratamiento.disposicion_final)} kg a disposición final.`,
    50,
    y,
    { width: W },
  );
  y = doc.y + 8;

  // ── Balance de masa (Córdoba y jurisdicciones que lo exigen) ──────────────
  if (regimen?.camposCertificado?.some((c) => c.campo === 'balanceMasa')) {
    if (y > doc.page.height - 180) { doc.addPage(); y = 50; }
    doc.font('Helvetica-Bold').fontSize(10).fillColor(VERDE).text('Balance de masa', 50, y, { width: W });
    y = doc.y + 4;
    doc.font('Helvetica').fontSize(9).fillColor('black');
    doc.text(`Ingresado: ${n(total)} kg`, 54, y); y = doc.y + 2;
    doc.text(`Valorizado (reciclado + reúso + compostaje): ${n(insumo)} kg (${total ? n((insumo / total) * 100) : 0} %)`, 54, y); y = doc.y + 2;
    doc.text(`Disposición final: ${n(porTratamiento.disposicion_final)} kg (${total ? n((porTratamiento.disposicion_final / total) * 100) : 0} %)`, 54, y);
    y = doc.y + 10;
  }

  // ── Notas y disclaimers ───────────────────────────────────────────────────
  if (materiales.some((m) => m.kgEstimado)) {
    doc.fontSize(8).fillColor('#555').text('"Estimado": kilos que no se pesaron en balanza (se calcularon por unidades estándar o los informó el chofer).', 50, y, { width: W });
    y = doc.y + 4;
  }

  const pieLegal = regimen?.normaPie
    ? `Esta constancia respalda la declaración jurada del generador conforme al régimen de ${regimen.nombre} (${regimen.normaPie}) ` +
      'y la Ley 25.612 (arts. 11 inc. e y 12). No reemplaza la declaración jurada ni los formularios que exija la autoridad ambiental.'
    : 'Esta constancia respalda la declaración jurada del generador sobre el reúso o reciclado de sus residuos (Ley 25.612, arts. 11 inc. e y 12) ' +
      'y sus informes de sustentabilidad. No reemplaza la declaración jurada ni los formularios que exija la autoridad ambiental provincial. ' +
      'El detalle retiro por retiro está en los certificados de disposición sustentable, verificables por su código QR.';
  doc.fontSize(8).fillColor('#555').text(pieLegal, 50, y, { width: W });

  if (regimen && !regimen.verificado) {
    doc.moveDown(0.3).fontSize(7).fillColor('#999').text(
      '⚠ Los requisitos jurisdiccionales incluidos fueron compilados de fuentes secundarias y podrían no estar actualizados. ' +
        'Verificar con la autoridad ambiental antes de presentar este documento.',
      50,
      doc.y,
      { width: W },
    );
  }

  // ── Firma y sello ─────────────────────────────────────────────────────────
  const yf = Math.max(doc.y + 30, doc.page.height - 200);
  if (yf > doc.page.height - 100) doc.addPage();
  const yFirma = yf > doc.page.height - 100 ? 50 : yf;
  if (sello) doc.image(sello, 300, yFirma, { fit: [90, 90] });
  if (firma) doc.image(firma, 400, yFirma + 10, { fit: [140, 60] });
  doc.moveTo(400, yFirma + 75).lineTo(545, yFirma + 75).strokeColor('#999').stroke();
  doc.fontSize(10).fillColor('black').text(cert.responsable ?? 'Firma del responsable', 400, yFirma + 80, { width: 145, align: 'center' });
  if (cert.cargo) doc.fontSize(9).fillColor('#555').text(cert.cargo, 400, yFirma + 94, { width: 145, align: 'center' });
  if (regimen?.firmaResponsableTecnico) {
    doc.fontSize(8).fillColor('#777').text('Responsable técnico matriculado', 400, yFirma + 106, { width: 145, align: 'center' });
  }
  doc.fontSize(8).fillColor('#777').text(`Emitida el ${new Date().toLocaleDateString('es-AR')}`, 50, yFirma + 94);
  doc.end();
}

/** Desde el panel de la cooperativa: /api/clientes/:id/constancia-reciclado.pdf?anio= */
export const constanciaRouter = Router();
constanciaRouter.get('/:id/constancia-reciclado.pdf', requireRole('administracion'), async (req, res) => {
  const anio = anioInput.default(new Date().getFullYear()).parse(req.query.anio);
  const d = await datosConstancia(req.params.id, anio);
  res.type('application/pdf').setHeader('Content-Disposition', `attachment; filename="constancia-reciclado-${anio}.pdf"`);
  await renderConstanciaPdf(d, res);
});
