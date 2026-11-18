// PDF del comprobante electrónico AFIP (una carilla A4). Incluye el QR AFIP
// obligatorio (RG 4.892/2020), el CAE, su vencimiento y, si corresponde, un sello
// "COMPROBANTE SIMULADO" cuando el modo es mock.
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { Organization } from '../organizations/organization.model.js';
import { Invoice } from '../invoices/invoice.model.js';
import { currentTenant } from '../../lib/tenancy.js';
import { ComprobanteAfip, TIPOS_CBTE, COND_IVA_RECEPTOR, DOC_TIPOS, fmtComprobante } from './comprobante.model.js';
import { urlQrAfip } from './afip-qr.js';
import { HttpError } from '../../middleware/error.js';

const TEAL = '#0f766e';
const fmtN = (n) => Number(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtP = (n) => '$ ' + fmtN(n);
const fmtFecha = (d) => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const cuitFmt = (c) => {
  const s = String(c ?? '').replace(/\D/g, '');
  return s.length === 11 ? `${s.slice(0, 2)}-${s.slice(2, 10)}-${s[10]}` : c || '—';
};

export async function renderComprobantePdf(comprobanteId, stream) {
  const c = await ComprobanteAfip.findById(comprobanteId).populate('invoice');
  if (!c) throw new HttpError(404, 'Comprobante no encontrado');
  const org = await Organization.findById(currentTenant()).lean();
  const qrUrl = urlQrAfip({
    fecha: c.fecha,
    cuitEmisor: org.cuit,
    ptoVta: c.ptoVta,
    tipoCmp: c.tipo,
    nroCmp: c.numero,
    importe: c.importeTotal,
    moneda: c.moneda,
    ctz: c.cotizacion,
    tipoDocRec: c.docTipo,
    nroDocRec: c.docNro,
    codAut: c.cae,
  });
  const qrPng = await QRCode.toBuffer(qrUrl, { margin: 1, width: 260 });

  const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `Comprobante ${fmtComprobante(c)}` } });
  doc.pipe(stream);
  const W = doc.page.width - 80;

  // Encabezado: emisor izquierda, tipo/numero derecha
  doc.fillColor(TEAL).fontSize(18).font('Helvetica-Bold').text(org.nombre, 40, 40);
  doc.fillColor('#000').fontSize(10).font('Helvetica')
    .text(`CUIT ${cuitFmt(org.cuit)}`, { continued: false })
    .text(`${org.domicilio ?? ''}`)
    .text(`${org.jurisdiccion?.ciudad ?? ''}${org.jurisdiccion?.provincia ? ', ' + org.jurisdiccion.provincia : ''}`);

  doc.font('Helvetica-Bold').fontSize(22).fillColor(TEAL).text(TIPOS_CBTE[c.tipo] ?? 'Comprobante', W - 180, 40, { width: 220, align: 'right' });
  doc.fillColor('#000').fontSize(11).font('Helvetica').text(fmtComprobante(c), { width: 220, align: 'right' });
  doc.text(`Fecha: ${fmtFecha(c.fecha)}`, { width: 220, align: 'right' });

  if (c.modo === 'mock' || c.resultado === 'simulado') {
    doc.save().fillColor('#b42318').fontSize(36).font('Helvetica-Bold').rotate(-18, { origin: [doc.page.width / 2, 400] })
      .text('COMPROBANTE SIMULADO', 80, 380).restore();
  }

  // Receptor
  doc.moveDown(2).fillColor('#000').font('Helvetica-Bold').fontSize(11).text('Receptor', 40);
  doc.font('Helvetica').fontSize(10)
    .text(`${c.receptorNombre ?? '—'}`)
    .text(`${DOC_TIPOS[c.docTipo] ?? 'Doc'}: ${c.docNro}`)
    .text(`Condición IVA: ${COND_IVA_RECEPTOR[c.condIvaReceptor] ?? '—'}`);

  // Importes
  doc.moveDown(1).font('Helvetica-Bold').fontSize(11).text('Importes');
  const y0 = doc.y + 4;
  doc.font('Helvetica').fontSize(10);
  const linea = (label, val, dy) => {
    doc.text(label, 40, y0 + dy, { width: 300, continued: false });
    doc.text(fmtP(val), 40 + 300, y0 + dy, { width: W - 300, align: 'right' });
  };
  let dy = 0;
  if (c.importeNeto) { linea('Neto gravado', c.importeNeto, dy); dy += 14; }
  if (c.importeIva) { linea('IVA', c.importeIva, dy); dy += 14; }
  if (c.importeExento) { linea('Exento', c.importeExento, dy); dy += 14; }
  if (c.importeNoGravado) { linea('No gravado', c.importeNoGravado, dy); dy += 14; }
  if (c.importeTributos) { linea('Otros tributos', c.importeTributos, dy); dy += 14; }
  doc.font('Helvetica-Bold').text('Total', 40, y0 + dy, { width: 300 });
  doc.text(fmtP(c.importeTotal), 40 + 300, y0 + dy, { width: W - 300, align: 'right' });

  // QR y CAE al pie
  const yQR = doc.page.height - 200;
  doc.image(qrPng, 40, yQR, { width: 130, height: 130 });
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(11).text('Datos AFIP', 190, yQR);
  doc.font('Helvetica').fontSize(10)
    .text(`CAE N°: ${c.cae ?? '—'}`, 190, yQR + 18)
    .text(`Vencimiento del CAE: ${c.caeVence ? fmtFecha(c.caeVence) : '—'}`, 190, yQR + 34)
    .text(`Comprobante autorizado por AFIP${c.modo === 'mock' ? ' (ambiente de PRUEBAS)' : ''}.`, 190, yQR + 50, { width: W - 190 });

  doc.end();
}
