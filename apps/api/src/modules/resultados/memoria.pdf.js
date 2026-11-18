// PDF de la memoria anual (una carilla). Toma lo que arma memoriaAnual().
import PDFDocument from 'pdfkit';

const TEAL = '#0f766e';
const fmtN = (n) => Number(n ?? 0).toLocaleString('es-AR', { maximumFractionDigits: 2 });
const fmtKg = (n) => `${fmtN(n)} kg`;
const fmtT = (n) => `${fmtN((n ?? 0) / 1000)} t`;
const fmtP = (n) => Number(n ?? 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

export function renderMemoriaPdf(org, m, stream) {
  const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `Memoria anual ${m.anio}` } });
  doc.pipe(stream);
  const ancho = doc.page.width - 96;

  doc.fillColor(TEAL).fontSize(20).font('Helvetica-Bold').text(`Memoria anual ${m.anio}`, 48, 48);
  doc.fillColor('#000').fontSize(12).font('Helvetica').text(org.nombre);
  if (org.jurisdiccion?.ciudad) doc.fontSize(10).fillColor('#555').text(org.jurisdiccion.ciudad);
  doc.moveDown(0.8).fillColor('#000');

  const seccion = (titulo) => {
    doc.moveDown(0.4).font('Helvetica-Bold').fontSize(11).fillColor(TEAL).text(titulo).fillColor('#000').font('Helvetica').fontSize(10);
  };
  const filas = (cols, rows) => {
    const anchoCol = ancho / cols.length;
    doc.font('Helvetica-Bold').fontSize(9);
    cols.forEach((c, i) => doc.text(c, 48 + i * anchoCol, doc.y, { width: anchoCol - 4, align: i ? 'right' : 'left', continued: i < cols.length - 1 }));
    doc.moveDown(0.3).font('Helvetica').fontSize(10);
    if (!rows.length) {
      doc.fillColor('#999').text('Sin datos en el año.', 48, doc.y).fillColor('#000');
      return;
    }
    for (const r of rows.slice(0, 10)) {
      r.forEach((v, i) => doc.text(String(v), 48 + i * anchoCol, doc.y, { width: anchoCol - 4, align: i ? 'right' : 'left', continued: i < r.length - 1 }));
      doc.moveDown(0.2);
    }
    doc.moveDown(0.3);
  };

  seccion('Totales del año');
  filas(['Concepto', 'Valor'], [
    ['Ingresado a la planta', fmtT(m.totales.ingresadoKg)],
    ['Vendido a la industria', fmtT(m.totales.vendidoKg)],
    ['A disposición final (rechazo)', fmtT(m.totales.rechazoKg)],
    ['Valorización', m.totales.valorizacion == null ? '—' : `${fmtN(m.totales.valorizacion)} %`],
    ['Facturado por ventas', fmtP(m.totales.monto)],
    ['Huella de carbono (Alcances 1 y 2)', `${fmtT(m.totales.huellaKg)} CO₂e`],
    ['Emisiones evitadas (EPA WARM)', `${fmtT(m.totales.evitadoKg)} CO₂e`],
  ]);

  seccion('Ingresos por origen');
  filas(['Origen', 'Kg'], m.porOrigen.map((o) => [o.origen ?? '—', fmtKg(o.kg)]));

  seccion('Ventas por material');
  filas(['Material', 'Kg', 'Importe'], m.ventasMaterial.map((v) => [v.material ?? '—', fmtKg(v.kg), fmtP(v.monto)]));

  seccion('Principales compradores');
  filas(['Comprador', 'Kg'], m.compradores.map((c) => [c.comprador ?? '—', fmtKg(c.kg)]));

  seccion('Rechazo por causa');
  filas(['Causa', 'Kg'], m.porCausa.map((c) => [c.causa, fmtKg(c.kg)]));

  doc.moveDown(0.8).fontSize(8).fillColor('#555')
    .text(`Huella: ${m.huella.fuente.nombre}. Emisiones evitadas: ${m.evitadas.fuente.nombre}.`, { width: ancho });
  doc.end();
}
