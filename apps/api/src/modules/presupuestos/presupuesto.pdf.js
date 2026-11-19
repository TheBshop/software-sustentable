// PDF simple de presupuesto. No es documento fiscal.
import PDFDocument from 'pdfkit';

const TEAL = '#0f766e';
const fmtFecha = (d) => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtAr = (n) => Number(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cuit = (c) => {
  const d = String(c ?? '').replace(/\D/g, '');
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d[10]}` : c || '—';
};
const pad = (n, w = 5) => String(n ?? '').padStart(w, '0');

export function renderPresupuestoPdf(p, org, stream) {
  const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `Presupuesto ${pad(p.numero)}` } });
  doc.pipe(stream);
  const ancho = doc.page.width - 96;

  doc.fillColor(TEAL).fontSize(18).font('Helvetica-Bold').text('PRESUPUESTO', 48, 48);
  doc.fillColor('#000').fontSize(11).font('Helvetica').text(`N° ${pad(p.numero)}`, 48, 50, { width: ancho, align: 'right' });
  doc.text(`Fecha: ${fmtFecha(p.emitidoEn)}`, { width: ancho, align: 'right' });
  doc.text(`Vigencia: ${fmtFecha(p.vigenciaHasta)}`, { width: ancho, align: 'right' });
  doc.fontSize(9).fillColor('#555').text('Documento no válido como factura', { width: ancho, align: 'right' });

  doc.moveDown(1.5).fillColor('#000');
  doc.font('Helvetica-Bold').fontSize(10).text('Emisor');
  doc.font('Helvetica').fontSize(10).text(org.nombre).text(`CUIT ${cuit(org.cuit)}`);
  doc.moveDown(0.6);
  doc.font('Helvetica-Bold').fontSize(10).text('Cliente');
  doc.font('Helvetica').fontSize(10).text(p.clienteSnapshot?.razonSocial || '—');
  if (p.clienteSnapshot?.cuit) doc.text(`CUIT ${cuit(p.clienteSnapshot.cuit)}`);

  doc.moveDown(1);
  const y0 = doc.y + 6;
  const cols = [['Descripción', 280], ['Cant.', 60], ['Unidad', 70], ['P. unit.', 70], ['Subtotal', 80]];
  doc.font('Helvetica-Bold').fontSize(10);
  let x = 48;
  for (const [t, w] of cols) { doc.text(t, x, y0, { width: w, align: t === 'Descripción' ? 'left' : 'right' }); x += w; }
  doc.moveTo(48, y0 + 18).lineTo(48 + ancho, y0 + 18).strokeColor('#ccc').stroke();
  doc.font('Helvetica').fontSize(10);
  let y = y0 + 24;
  for (const l of p.lineas) {
    x = 48;
    doc.text(l.descripcion, x, y, { width: cols[0][1] }); x += cols[0][1];
    doc.text(fmtAr(l.cantidad), x, y, { width: cols[1][1], align: 'right' }); x += cols[1][1];
    doc.text(l.unidad || '', x, y, { width: cols[2][1], align: 'right' }); x += cols[2][1];
    doc.text(fmtAr(l.precioUnitario), x, y, { width: cols[3][1], align: 'right' }); x += cols[3][1];
    doc.text(fmtAr(l.subtotal), x, y, { width: cols[4][1], align: 'right' });
    y += 18;
  }
  doc.moveTo(48, y + 4).lineTo(48 + ancho, y + 4).strokeColor('#ccc').stroke();
  doc.font('Helvetica-Bold').fontSize(12).text(`TOTAL: $ ${fmtAr(p.total)}`, 48, y + 12, { width: ancho, align: 'right' });

  if (p.notas) { doc.moveDown(2).font('Helvetica-Oblique').fontSize(9).fillColor('#555').text(p.notas, { width: ancho }); }
  doc.end();
}
