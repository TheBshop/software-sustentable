import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { verificationUrl } from './certificate.service.js';

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
  doc.fillColor('white').fontSize(20).text('Cooperativa Nueva Vida', 50, 28);
  doc.fontSize(11).text('Reciclado con inclusión social · Paraná, Entre Ríos', 50, 55);

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
  const cols = [50, 300, 420];
  let y = doc.y;
  doc.font('Helvetica-Bold').text('Material', cols[0], y).text('Peso (kg)', cols[1], y).text('CO2 evitado (kg)', cols[2], y);
  y += 20;
  doc.moveTo(50, y - 5).lineTo(545, y - 5).strokeColor('#ccc').stroke();
  doc.font('Helvetica');
  for (const m of cert.materiales) {
    doc.text(m.nombre + (m.pesoEstimado ? ' *' : ''), cols[0], y).text(fmtNum(m.pesoKg), cols[1], y).text(fmtNum(m.co2EvitadoKg), cols[2], y);
    y += 18;
  }
  doc.moveTo(50, y).lineTo(545, y).stroke();
  y += 8;
  doc.font('Helvetica-Bold').text('Total', cols[0], y).text(fmtNum(cert.totalKg), cols[1], y).text(fmtNum(cert.co2EvitadoKg), cols[2], y);
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
