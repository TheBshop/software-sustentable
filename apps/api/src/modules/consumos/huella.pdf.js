// PDF del reporte mensual de huella de carbono para firmar y presentar al cliente/municipio.
import PDFDocument from 'pdfkit';

const TEAL = '#0f766e';
const VERDE = '#10b981';
const ROJO = '#ef4444';
const GRIS = '#555';
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const fmt = (n) => Number(n ?? 0).toLocaleString('es-AR', { maximumFractionDigits: 1 });
const cuit = (c) => {
  const d = String(c ?? '').replace(/\D/g, '');
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d[10]}` : c || '—';
};

export function renderHuellaPdf(rep, org, stream) {
  const periodo = rep.periodo.mes ? `${MESES[rep.periodo.mes - 1]} ${rep.periodo.anio}` : `Año ${rep.periodo.anio}`;
  const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `Huella de carbono — ${periodo}` } });
  doc.pipe(stream);
  const ancho = doc.page.width - 96;

  // Cabecera
  doc.fillColor(TEAL).fontSize(20).font('Helvetica-Bold').text('REPORTE DE HUELLA DE CARBONO', 48, 48);
  doc.fillColor('#000').fontSize(11).font('Helvetica').text(periodo, 48, 72);
  doc.fontSize(9).fillColor(GRIS).text(`Emitido el ${new Date().toLocaleDateString('es-AR')}`, 48, 50, { width: ancho, align: 'right' });

  // Emisor
  doc.moveDown(2);
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(10).text('Organización');
  doc.font('Helvetica').fontSize(10).text(org?.nombre || '—');
  if (org?.cuit) doc.text(`CUIT ${cuit(org.cuit)}`);
  if (org?.domicilio) doc.text(org.domicilio);

  // KPIs
  doc.moveDown(1.5);
  const yKpi = doc.y;
  const anchoKpi = (ancho - 20) / 3;
  const pintarKpi = (x, titulo, valor, color) => {
    doc.rect(x, yKpi, anchoKpi, 70).fillAndStroke('#f8fafc', '#e5e7eb');
    doc.fillColor(color).lineWidth(3).moveTo(x, yKpi).lineTo(x, yKpi + 70).stroke();
    doc.fillColor(GRIS).font('Helvetica').fontSize(9).text(titulo, x + 10, yKpi + 10, { width: anchoKpi - 20 });
    doc.fillColor('#000').font('Helvetica-Bold').fontSize(16).text(valor, x + 10, yKpi + 28, { width: anchoKpi - 20 });
    doc.fillColor(GRIS).font('Helvetica').fontSize(8).text('kg CO₂e', x + 10, yKpi + 50);
  };
  pintarKpi(48, 'Evitado (recuperación)', fmt(rep.evitado.totalKg), VERDE);
  pintarKpi(48 + anchoKpi + 10, 'Emitido (operación)', fmt(rep.emitido.totalKg), ROJO);
  pintarKpi(48 + (anchoKpi + 10) * 2, rep.esNegativo ? 'Balance (negativo)' : 'Balance (positivo)', `${rep.netoKg > 0 ? '+' : ''}${fmt(rep.netoKg)}`, rep.esNegativo ? ROJO : TEAL);
  doc.y = yKpi + 90;

  // Desgloses
  const tabla = (titulo, filas, labelCol = 'Fuente') => {
    if (!filas.length) return;
    doc.fillColor(TEAL).font('Helvetica-Bold').fontSize(12).text(titulo);
    doc.moveDown(0.3);
    const y0 = doc.y;
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000');
    doc.text(labelCol, 48, y0, { width: ancho - 100 });
    doc.text('kg CO₂e', 48 + ancho - 100, y0, { width: 100, align: 'right' });
    doc.moveTo(48, y0 + 14).lineTo(48 + ancho, y0 + 14).strokeColor('#e5e7eb').stroke();
    doc.font('Helvetica').fontSize(10);
    let y = y0 + 20;
    for (const [k, v] of filas) {
      doc.fillColor('#000').text(k, 48, y, { width: ancho - 100 });
      doc.text(fmt(v), 48 + ancho - 100, y, { width: 100, align: 'right' });
      y += 16;
    }
    doc.y = y + 8;
  };

  tabla('Emitido por servicio', Object.entries(rep.emitido.porServicio || {}).map(([k, v]) => [k.replace('_', ' '), v]));
  tabla('Emitido por combustible', Object.entries(rep.emitido.porCombustible || {}).map(([k, v]) => [k, v]));
  tabla('Evitado por material recuperado', (rep.evitado.porMaterial || []).map((m) => [`${m.nombre} (${fmt(m.kgProcesado)} kg)`, m.kgCo2]));

  // Metodología
  if (doc.y > doc.page.height - 180) doc.addPage();
  doc.moveDown(1);
  doc.fillColor(TEAL).font('Helvetica-Bold').fontSize(11).text('Metodología');
  doc.fillColor(GRIS).font('Helvetica').fontSize(9).text(
    'Alcance: GHG Protocol — emisiones directas de combustión (scope 1) y de electricidad adquirida (scope 2), ' +
    'confrontadas con las emisiones evitadas por recuperación de materiales. Factores de emisión de referencia: ' +
    'SIN Argentina (Secretaría de Energía) para electricidad, GHG Protocol para combustibles, y factores propios ' +
    'de cada material cargados en la plataforma (fuente declarada por la organización). Valores a verificar con el ' +
    'inventario propio de la organización. Este reporte no reemplaza una auditoría certificada.',
    { width: ancho, align: 'justify' },
  );

  // Firma
  const yFirma = doc.page.height - 130;
  doc.moveTo(48, yFirma).lineTo(48 + 200, yFirma).strokeColor('#000').stroke();
  doc.moveTo(48 + ancho - 200, yFirma).lineTo(48 + ancho, yFirma).stroke();
  doc.fillColor(GRIS).font('Helvetica').fontSize(9).text('Firma y sello del responsable', 48, yFirma + 6, { width: 200 });
  doc.text('Fecha', 48 + ancho - 200, yFirma + 6, { width: 200 });
  if (org?.certificado?.responsable) {
    doc.fillColor('#000').fontSize(10).text(org.certificado.responsable, 48, yFirma - 18);
    if (org.certificado.cargo) doc.fontSize(9).fillColor(GRIS).text(org.certificado.cargo, 48, yFirma - 6);
  }

  doc.end();
}
