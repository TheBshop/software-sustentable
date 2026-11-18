// Remito de traslado o venta de material (documento de cada traslado: Ley 25.612, art. 21).
import PDFDocument from 'pdfkit';
import { fmtRemito, fmtLote } from './proceso.models.js';

const TEAL = '#0f766e';
const fmtFecha = (d) => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtNum = (n) => Number(n ?? 0).toLocaleString('es-AR', { maximumFractionDigits: 2 });
const cuit = (c) => {
  const d = String(c ?? '').replace(/\D/g, '');
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d[10]}` : c || '—';
};

export function renderRemitoPdf(r, org, stream) {
  const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `Remito ${fmtRemito(r.numero)}` } });
  doc.pipe(stream);
  const ancho = doc.page.width - 96;

  doc.fillColor(TEAL).fontSize(18).font('Helvetica-Bold').text('REMITO', 48, 48);
  doc.fillColor('#000').fontSize(11).font('Helvetica').text(`N° ${fmtRemito(r.numero)}`, 48, 50, { width: ancho, align: 'right' });
  doc.text(`Fecha: ${fmtFecha(r.fecha)}`, { width: ancho, align: 'right' });
  doc.fontSize(9).fillColor('#555').text('Documento no válido como factura', { width: ancho, align: 'right' });
  if (r.anulado) {
    doc.save().fillColor('#b42318').fontSize(42).font('Helvetica-Bold').rotate(-20, { origin: [300, 400] }).text('ANULADO', 150, 380).restore();
  }

  doc.moveDown(1.5).fillColor('#000');
  const bloque = (titulo, lineas) => {
    doc.font('Helvetica-Bold').fontSize(10).text(titulo);
    doc.font('Helvetica').fontSize(10);
    for (const l of lineas.filter(Boolean)) doc.text(l);
    doc.moveDown(0.6);
  };
  bloque('Remitente', [org.nombre, `CUIT ${cuit(org.cuit)}`, org.domicilio]);
  bloque('Destinatario', [r.destinatario?.razonSocial, `CUIT ${cuit(r.destinatario?.cuit)}`, r.destinatario?.direcciones?.[0]?.direccion]);
  if (r.transporte?.razonSocial || r.transporte?.patente) bloque('Transporte', [r.transporte.razonSocial, r.transporte.patente && `Patente ${r.transporte.patente}`, r.transporte.chofer && `Chofer ${r.transporte.chofer}`]);

  // Detalle
  const y0 = doc.y + 6;
  const cols = [
    ['Material', 220],
    ['Lote', 90],
    ['Unidades', 80],
    ['Kg', ancho - 390],
  ];
  doc.rect(48, y0, ancho, 20).fill('#f1f4f5');
  let x = 54;
  doc.fillColor('#333').font('Helvetica-Bold').fontSize(9);
  for (const [t, w] of cols) {
    doc.text(t, x, y0 + 6, { width: w - 10, align: t === 'Kg' ? 'right' : 'left' });
    x += w;
  }
  let y = y0 + 26;
  doc.font('Helvetica').fontSize(10).fillColor('#000');
  for (const it of r.items) {
    x = 54;
    const fila = [it.material?.nombre ?? '—', it.lote?.numero ? fmtLote(it.lote.numero) : '—', it.unidades ?? '—', fmtNum(it.kg)];
    fila.forEach((v, i) => {
      doc.text(String(v), x, y, { width: cols[i][1] - 10, align: i === 3 ? 'right' : 'left' });
      x += cols[i][1];
    });
    y += 18;
  }
  doc.moveTo(48, y).lineTo(48 + ancho, y).strokeColor('#ccc').stroke();
  doc.font('Helvetica-Bold').text(`Total: ${fmtNum(r.items.reduce((a, i) => a + i.kg, 0))} kg`, 48, y + 8, { width: ancho - 6, align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor('#555').text(`Pesaje: ${r.pesaje === 'Estimado' ? 'estimado (sin báscula)' : 'báscula'}`, 48, y + 26);
  if (r.observaciones) doc.text(`Observaciones: ${r.observaciones}`);
  if (r.anulado) doc.fillColor('#b42318').text(`Anulado: ${r.motivoAnulacion}`);

  const yf = doc.page.height - 140;
  doc.fillColor('#000').fontSize(9);
  doc.moveTo(60, yf).lineTo(250, yf).stroke();
  doc.moveTo(330, yf).lineTo(520, yf).stroke();
  doc.text('Entrega (firma y aclaración)', 60, yf + 4, { width: 190, align: 'center' });
  doc.text('Recibe (firma, aclaración y DNI)', 330, yf + 4, { width: 190, align: 'center' });
  doc.end();
}
