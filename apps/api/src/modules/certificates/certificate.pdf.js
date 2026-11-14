import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { verificationUrl } from './certificate.service.js';
import { FRACCIONES } from '../materials/fracciones.js';

const VERDE = '#2f7d32';
const fmtFecha = (d) => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtNum = (n) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });

/** Escribe el PDF del certificado en el stream (p. ej. la respuesta HTTP). */
export async function renderCertificatePdf(cert, stream) {
  const url = verificationUrl(cert.codigo);
  const qr = await QRCode.toBuffer(url, { margin: 1, width: 300 });

  const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `Certificado N° ${cert.numero}` } });
  doc.pipe(stream);

  doc.rect(0, 0, doc.page.width, 90).fill(VERDE);
  doc.fillColor('white').fontSize(20).text(cert.emisorSnapshot?.nombre ?? 'Cooperativa', 50, 28);
  doc.fontSize(11).text(cert.emisorSnapshot?.cuit ? `CUIT ${cert.emisorSnapshot.cuit} · Reciclado con inclusión social` : 'Reciclado con inclusión social', 50, 55);

  doc.fillColor('black').moveDown(3);
  doc.fontSize(18).text('Certificado de Disposición Sustentable', 50, 120, { align: 'center' });
  doc.fontSize(11).fillColor('#555').text(`N° ${String(cert.numero).padStart(6, '0')} · Código ${cert.codigo}`, { align: 'center' });

  doc.moveDown(2).fillColor('black').fontSize(12);
  doc.text(`Generador: ${cert.clienteSnapshot.razonSocial}`);
  if (cert.clienteSnapshot.cuit) doc.text(`CUIT: ${cert.clienteSnapshot.cuit}`);
  doc.text(`Fecha de retiro: ${fmtFecha(cert.fechaRetiro)}`);
  doc.text(`Fecha de emisión: ${fmtFecha(cert.createdAt)}`);

  // Tabla de materiales
  doc.moveDown(1.5);
  const cols = [50, 270, 345, 440];
  let y = doc.y;
  doc.font('Helvetica-Bold').text('Material y fracción', cols[0], y).text('Peso (kg)', cols[1], y).text('CO2 (kg)', cols[2], y).text('Destino', cols[3], y);
  y += 20;
  doc.moveTo(50, y - 5).lineTo(545, y - 5).strokeColor('#ccc').stroke();
  doc.font('Helvetica');
  for (const m of cert.materiales) {
    const fr = FRACCIONES[m.fraccion];
    if (fr) doc.rect(cols[0], y + 1, 8, 8).fillAndStroke(fr.hex, '#999').fillColor('black');
    doc.text(m.nombre + (m.pesoEstimado ? ' *' : ''), cols[0] + (fr ? 13 : 0), y);
    if (fr) doc.fontSize(8).fillColor('#666').text(fr.nombre, cols[0] + 13, y + 12).fontSize(12).fillColor('black');
    doc.text(fmtNum(m.pesoKg), cols[1], y).text(fmtNum(m.co2EvitadoKg), cols[2], y).text(m.valorizable === false ? 'Disp. final' : 'Valorización', cols[3], y);
    y += fr ? 26 : 18;
  }
  doc.moveTo(50, y).lineTo(545, y).stroke();
  y += 8;
  doc.font('Helvetica-Bold').text('Total', cols[0], y).text(fmtNum(cert.totalKg), cols[1], y).text(fmtNum(cert.co2EvitadoKg), cols[2], y);
  doc.font('Helvetica').fontSize(8).fillColor('#666').text('Fracciones según el código unificado de colores del Decreto 779/2022 (reglamentario de la Ley 25.916).', 50, y + 16, { width: 495 }).fontSize(12).fillColor('black');
  y += 10;
  doc.font('Helvetica');

  if (cert.materiales.some((m) => m.pesoEstimado)) {
    doc.fontSize(9).fillColor('#555').text('* Peso estimado al momento del retiro.', 50, y + 25);
  }

  // QR de validación
  doc.image(qr, 50, y + 60, { width: 120 });
  doc.fontSize(10).fillColor('black').text('Escaneá el código QR para verificar la autenticidad de este certificado:', 185, y + 85, { width: 360 });
  doc.fillColor(VERDE).text(url, 185, y + 115, { width: 360, link: url });

  doc.fontSize(8).fillColor('#777').text(
    'El CO2 evitado se estima con factores de emisión por material configurados por la cooperativa.',
    50,
    doc.page.height - 80,
    { width: 495, align: 'center' },
  );
  doc.end();
}
