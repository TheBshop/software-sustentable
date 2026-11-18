// PDF del manifiesto con QR público que apunta a /recibir/<codigo>.
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { env } from '../../config/env.js';
import { fmtManifiesto } from './manifiesto.model.js';

const TEAL = '#0f766e';
const fmtFecha = (d) => (d ? new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
const fmtHora = (d) => (d ? new Date(d).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '—');
const fmtN = (n) => Number(n ?? 0).toLocaleString('es-AR', { maximumFractionDigits: 2 });
const cuit = (c) => {
  const s = String(c ?? '').replace(/\D/g, '');
  return s.length === 11 ? `${s.slice(0, 2)}-${s.slice(2, 10)}-${s[10]}` : c ?? '—';
};

export async function renderManifiestoPdf(m, org, stream) {
  const url = `${env.publicWebUrl}/recibir/${m.codigo}`;
  const qr = await QRCode.toBuffer(url, { margin: 1, width: 240 });
  const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `Manifiesto ${fmtManifiesto(m)}` } });
  doc.pipe(stream);
  const ancho = doc.page.width - 96;

  doc.fillColor(TEAL).fontSize(18).font('Helvetica-Bold').text('MANIFIESTO DE TRASLADO', 48, 48);
  doc.fillColor('#000').fontSize(11).font('Helvetica').text(`N° ${fmtManifiesto(m)}`, 48, 50, { width: ancho, align: 'right' });
  doc.text(`Fecha: ${fmtFecha(m.fecha)}`, { width: ancho, align: 'right' });
  doc.fontSize(9).fillColor('#555').text('Documento de cada traslado (Ley 25.612 art. 21)', { width: ancho, align: 'right' });

  if (m.estado === 'anulado') {
    doc.save().fillColor('#b42318').fontSize(44).font('Helvetica-Bold').rotate(-20, { origin: [300, 400] }).text('ANULADO', 150, 380).restore();
  }

  doc.moveDown(1.5).fillColor('#000');
  const bloque = (titulo, lineas) => {
    doc.font('Helvetica-Bold').fontSize(10).text(titulo);
    doc.font('Helvetica').fontSize(10);
    for (const l of lineas.filter(Boolean)) doc.text(l);
    doc.moveDown(0.6);
  };
  bloque('Origen', [m.origen?.razonSocial ?? org.nombre, `CUIT ${cuit(m.origen?.cuit ?? org.cuit)}`, m.origen?.direccion ?? org.domicilio]);
  bloque('Destino', [m.destino?.razonSocial, `CUIT ${cuit(m.destino?.cuit)}`, m.destino?.direccion]);
  if (m.transporte?.razonSocial || m.transporte?.patente) {
    bloque('Transporte', [m.transporte.razonSocial, m.transporte.patente && `Patente ${m.transporte.patente}`, m.transporte.chofer && `Chofer ${m.transporte.chofer}`, m.transporte.habilitacion && `Habilitación ${m.transporte.habilitacion}`]);
  }
  bloque('Corriente', [m.corriente ? m.corriente.toUpperCase() : '—']);

  // Detalle
  doc.font('Helvetica-Bold').fontSize(10).text('Residuos trasladados');
  const y0 = doc.y + 4;
  doc.rect(48, y0, ancho, 20).fill('#f1f4f5');
  doc.fillColor('#333').fontSize(9).font('Helvetica-Bold');
  doc.text('Material', 54, y0 + 6);
  doc.text('Unidades', 54 + ancho * 0.6, y0 + 6, { width: ancho * 0.18, align: 'right' });
  doc.text('Kg', 54 + ancho * 0.8, y0 + 6, { width: ancho * 0.18, align: 'right' });
  let y = y0 + 26;
  doc.font('Helvetica').fontSize(10).fillColor('#000');
  for (const it of m.items ?? []) {
    doc.text(it.material?.nombre ?? '—', 54, y, { width: ancho * 0.6 });
    doc.text(it.unidades ?? '—', 54 + ancho * 0.6, y, { width: ancho * 0.18, align: 'right' });
    doc.text(fmtN(it.kg), 54 + ancho * 0.8, y, { width: ancho * 0.18, align: 'right' });
    y += 18;
  }
  doc.moveTo(48, y).lineTo(48 + ancho, y).strokeColor('#ccc').stroke();
  const totalKg = (m.items ?? []).reduce((a, i) => a + i.kg, 0);
  doc.font('Helvetica-Bold').text(`Total: ${fmtN(totalKg)} kg`, 48, y + 8, { width: ancho - 6, align: 'right' });

  // Estado + QR al pie
  const yQR = doc.page.height - 220;
  doc.image(qr, 48, yQR, { width: 120, height: 120 });
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(11).text('Confirmación de recepción', 180, yQR);
  if (m.estado === 'recibido' && m.recepcion) {
    doc.font('Helvetica').fontSize(10)
      .text(`Recibido el ${fmtFecha(m.recepcion.fecha)} a las ${fmtHora(m.recepcion.fecha)}`, 180, yQR + 20)
      .text(`Por: ${m.recepcion.firmanteNombre}${m.recepcion.firmanteDni ? ` · DNI ${m.recepcion.firmanteDni}` : ''}`, 180, yQR + 36);
    if (m.recepcion.lat && m.recepcion.lng) doc.text(`Geolocalización: ${m.recepcion.lat.toFixed(5)}, ${m.recepcion.lng.toFixed(5)}`, 180, yQR + 52);
    if (m.recepcion.observaciones) doc.text(`Observaciones: ${m.recepcion.observaciones}`, 180, yQR + 68, { width: ancho - 180 });
  } else {
    doc.font('Helvetica').fontSize(10).fillColor('#555').text('Pendiente. El destinatario escanea el QR para confirmar la recepción con firma, DNI y geolocalización.', 180, yQR + 20, { width: ancho - 180 });
    doc.fillColor('#000').fontSize(9).text(url, 180, yQR + 70, { width: ancho - 180 });
  }
  doc.end();
}
