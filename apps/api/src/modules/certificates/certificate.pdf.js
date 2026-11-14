import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { verificationUrl } from './certificate.service.js';
import { FRACCIONES } from '../materials/fracciones.js';
import { leerArchivo } from '../../lib/storage.js';

const VERDE = '#2f7d32';
const fmtFecha = (d) => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtNum = (n) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });

const fmtPesos = (n) => Number(n).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });
const MODALIDADES = { abono_mensual: 'incluido en el abono mensual', sin_cargo: 'sin cargo' };

/** Imagen de firma o sello; si no se puede leer, el certificado se emite igual sin ella. */
async function imagen(url) {
  if (!url) return null;
  try {
    return await leerArchivo(url);
  } catch {
    return null;
  }
}

/**
 * Escribe el PDF del certificado en el stream (p. ej. la respuesta HTTP).
 * `mostrarCosto`: el costo del servicio solo va en el PDF de la cooperativa y del cliente,
 * no en el que se descarga públicamente desde el QR.
 */
export async function renderCertificatePdf(cert, stream, { mostrarCosto = false } = {}) {
  const url = verificationUrl(cert.codigo);
  const qr = await QRCode.toBuffer(url, { margin: 1, width: 300 });
  const [firma, sello] = await Promise.all([imagen(cert.emisorSnapshot?.firmaUrl), imagen(cert.emisorSnapshot?.selloUrl)]);

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
  // Habilitaciones del emisor (ej. registro municipal de acopios, Ord. 9233 de Paraná, art. 28)
  for (const r of cert.emisorSnapshot?.registros ?? []) {
    doc.fontSize(9).fillColor('#555').text(`${r.descripcion} N° ${r.numero}${r.organismo ? ` · ${r.organismo}` : ''}`).fontSize(12).fillColor('black');
  }

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
    doc.fontSize(9).fillColor('#555').text('* Peso estimado al momento del retiro (sin balanza o por unidades estándar).', 50, y + 25);
  }
  if (mostrarCosto && cert.costoServicio?.modalidad) {
    const c = cert.costoServicio;
    const texto = c.importe != null ? fmtPesos(c.importe) : MODALIDADES[c.modalidad] ?? '—';
    doc.fontSize(11).fillColor('black').text(`Costo del servicio: ${texto}`, 50, y + 40);
    y += 14;
  }

  // QR de validación
  doc.image(qr, 50, y + 60, { width: 120 });
  doc.fontSize(10).fillColor('black').text('Escaneá el código QR para verificar la autenticidad de este certificado:', 185, y + 85, { width: 360 });
  doc.fillColor(VERDE).text(url, 185, y + 115, { width: 360, link: url });

  // Firma y sello de la cooperativa
  const yf = Math.min(y + 200, doc.page.height - 190);
  if (sello) doc.image(sello, 300, yf, { fit: [90, 90] });
  if (firma) doc.image(firma, 400, yf + 10, { fit: [140, 60] });
  const responsable = cert.emisorSnapshot?.responsable;
  if (firma || sello || responsable) {
    doc.moveTo(400, yf + 75).lineTo(545, yf + 75).strokeColor('#999').stroke();
    doc.fontSize(10).fillColor('black').text(responsable ?? 'Firma del responsable', 400, yf + 80, { width: 145, align: 'center' });
    if (cert.emisorSnapshot?.cargo) doc.fontSize(9).fillColor('#555').text(cert.emisorSnapshot.cargo, 400, yf + 94, { width: 145, align: 'center' });
  }

  // Metodología: factor y fuente de cada material (trazabilidad del cálculo) y uso en reportes GHG
  const factores = [...new Map(cert.materiales.filter((m) => m.factorCo2 != null).map((m) => [m.nombre, m])).values()];
  const lineaFactores = factores.length
    ? 'Factores: ' + factores.map((m) => `${m.nombre} ${fmtNum(m.factorCo2)} kg CO2e/kg (${m.factorCo2Fuente || 'fuente no indicada'})`).join('; ') + '. '
    : 'El CO2 evitado se estima con factores de emisión por material configurados por la cooperativa. ';
  doc.fontSize(7).fillColor('#777').text(
    lineaFactores +
      'Para el generador, los kilos son dato de actividad de Alcance 3, categoría 5 (residuos generados en las operaciones) del GHG Protocol. ' +
      'Las emisiones evitadas por reciclar se informan aparte y no se restan del inventario.',
    50,
    doc.page.height - 88,
    { width: 495, align: 'center' },
  );
  doc.end();
}
