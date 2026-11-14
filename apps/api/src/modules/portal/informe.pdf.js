import PDFDocument from 'pdfkit';

const VERDE = '#2f7d32';
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const n = (v, d = 1) => Number(v ?? 0).toLocaleString('es-AR', { maximumFractionDigits: d });

/**
 * Informe anual de impacto para empresas y municipios (reportes de sustentabilidad,
 * rendiciones). `org`: { nombre, cuit, tipo }; `r`: resultado de resumenAnual().
 */
export function renderInformeAnual(org, r, stream) {
  const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `Informe ${r.anio} · ${org.nombre}` } });
  doc.pipe(stream);
  const W = doc.page.width - 100;

  doc.rect(0, 0, doc.page.width, 90).fill(VERDE);
  doc.fillColor('white').fontSize(20).text(`Informe de gestión de residuos ${r.anio}`, 50, 26);
  doc.fontSize(11).text(`${org.nombre}${org.cuit ? ` · CUIT ${org.cuit}` : ''}`, 50, 56);
  doc.fillColor('black');

  // KPIs
  let y = 115;
  const kpis = [
    ['Material retirado', `${n(r.totales.kg)} kg`],
    ['Retiros', n(r.totales.retiros, 0)],
    ['Valorizable', r.totales.tasaValorizacion == null ? '—' : `${n(r.totales.tasaValorizacion)} %`],
    ['CO2 evitado (estimado)', `${n(r.totales.co2EvitadoKg)} kg`],
  ];
  const kw = W / kpis.length;
  kpis.forEach(([label, value], i) => {
    const x = 50 + i * kw;
    doc.roundedRect(x, y, kw - 8, 52, 6).fillAndStroke('#eef5ee', '#d6e6d6').fillColor('#555').fontSize(9).text(label, x + 8, y + 8, { width: kw - 24 });
    doc.fillColor('black').fontSize(15).text(value, x + 8, y + 24, { width: kw - 24 });
  });
  y += 72;
  doc.fontSize(9).fillColor('#555').text(`${n(r.totales.certificados, 0)} certificados de disposición sustentable emitidos en el año (verificables por QR).`, 50, y);
  y += 24;

  // Gráfico por mes
  doc.fillColor('black').fontSize(13).text('Kilos retirados por mes', 50, y);
  y += 20;
  const chartH = 120;
  const max = Math.max(1, ...r.porMes.map((m) => m.kg));
  const bw = W / 12;
  doc.moveTo(50, y + chartH).lineTo(50 + W, y + chartH).strokeColor('#bbb').stroke();
  r.porMes.forEach((m, i) => {
    const h = (m.kg / max) * (chartH - 14);
    const x = 50 + i * bw + 6;
    if (h > 0) doc.rect(x, y + chartH - h, bw - 12, h).fill(VERDE);
    doc.fillColor('#555').fontSize(8).text(MESES[i], 50 + i * bw, y + chartH + 4, { width: bw, align: 'center' });
    if (m.kg > 0) doc.text(n(m.kg, 0), 50 + i * bw, y + chartH - h - 11, { width: bw, align: 'center' });
  });
  y += chartH + 30;

  const tabla = (titulo, filas, cols) => {
    if (y > doc.page.height - 160) {
      doc.addPage();
      y = 50;
    }
    doc.fillColor('black').fontSize(13).text(titulo, 50, y);
    y += 20;
    doc.fontSize(9).fillColor('#555');
    cols.forEach(([h, x]) => doc.text(h, x, y));
    y += 14;
    doc.moveTo(50, y - 2).lineTo(50 + W, y - 2).strokeColor('#ddd').stroke();
    doc.fontSize(10).fillColor('black');
    for (const f of filas) {
      if (y > doc.page.height - 70) {
        doc.addPage();
        y = 50;
      }
      f.forEach((v, i) => {
        if (v && typeof v === 'object' && v.hex) {
          doc.rect(cols[i][1], y + 1, 8, 8).fillAndStroke(v.hex, '#999').fillColor('black');
          doc.text(v.texto, cols[i][1] + 13, y);
        } else doc.text(String(v ?? ''), cols[i][1], y, { width: (cols[i + 1]?.[1] ?? 50 + W) - cols[i][1] - 6 });
      });
      y += 16;
    }
    y += 14;
  };

  tabla(
    'Por fracción (código de colores, Decreto 779/2022)',
    r.porFraccion.map((f) => [{ hex: f.hex, texto: f.nombre }, f.color, `${n(f.kg)} kg`]),
    [['Fracción', 50], ['Color', 300], ['Kilos', 420]],
  );
  tabla('Por material', r.porMaterial.map((m) => [m.material, `${n(m.kg)} kg`, `${n(m.co2EvitadoKg)} kg`]), [['Material', 50], ['Kilos', 300], ['CO2 evitado', 420]]);
  if (r.porSede.length > 1) {
    tabla('Por sede', r.porSede.map((s) => [s.sede, n(s.retiros, 0), `${n(s.kg)} kg`]), [['Sede', 50], ['Retiros', 340], ['Kilos', 420]]);
  }
  tabla('Cooperativas que prestaron el servicio', r.porCooperativa.map((c) => [c.cooperativa, n(c.retiros, 0), `${n(c.kg)} kg`]), [['Cooperativa', 50], ['Retiros', 340], ['Kilos', 420]]);

  if (y > doc.page.height - 120) {
    doc.addPage();
    y = 50;
  }
  doc.fontSize(8).fillColor('#666').text(
    'Metodología: los kilos son los pesados en planta o, si todavía no se pesaron, los estimados al retirar. "Valorizable" es el material ' +
      'que no se clasifica como basura y puede reinsertarse en el circuito productivo (jerarquía de opciones de la Ley 25.916). El CO2 evitado ' +
      'se estima con factores por material configurados por cada cooperativa. Generado el ' +
      new Date().toLocaleDateString('es-AR') +
      '.',
    50,
    y,
    { width: W },
  );
  doc.end();
}
