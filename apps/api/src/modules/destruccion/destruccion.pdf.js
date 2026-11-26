import PDFDocument from 'pdfkit';

const VERDE = '#2f7d32';
const fmtFecha = (d) => (d ? new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');

const METODO_LABEL = {
  borrado_seguro: 'Borrado seguro (sobreescritura NIST 800-88)',
  desmagnetizacion: 'Desmagnetización (degaussing)',
  destruccion_fisica: 'Destrucción física (trituración/perforación)',
  borrado_criptografico: 'Borrado criptográfico (crypto-erase)',
};

const TIPO_LABEL = {
  disco_rigido: 'Disco rígido (HDD)',
  ssd: 'Unidad de estado sólido (SSD)',
  pendrive: 'Pendrive / USB',
  cinta_magnetica: 'Cinta magnética',
  telefono: 'Teléfono',
  tablet: 'Tablet',
  notebook: 'Notebook',
  servidor: 'Servidor',
  otro: 'Otro',
};

export async function renderDestruccionPdf(cert, stream) {
  const doc = new PDFDocument({ size: 'A4', margin: 44, info: { Title: `Certificado de Destrucción Segura N° ${cert.numero}` } });
  doc.pipe(stream);
  const W = doc.page.width - 88;
  const X = 44;

  // Header
  doc.rect(0, 0, doc.page.width, 72).fill(VERDE);
  doc.fillColor('white').fontSize(16).text('Certificado de Destrucción Segura de Datos', X, 18, { width: W });
  doc.fontSize(11).text(`N° ${String(cert.numero).padStart(6, '0')}`, X, 42, { width: W });

  let y = 90;

  // Info block
  doc.fillColor('#333').fontSize(10);
  const info = [
    ['Fecha de destrucción', fmtFecha(cert.fechaDestruccion)],
    ['Cliente', cert.clienteNombre],
    ...(cert.clienteCuit ? [['CUIT', cert.clienteCuit]] : []),
    ['Responsable', cert.responsable],
    ['Fecha de emisión', fmtFecha(cert.createdAt)],
  ];
  for (const [label, val] of info) {
    doc.font('Helvetica-Bold').text(`${label}: `, X, y, { continued: true }).font('Helvetica').text(val);
    y += 16;
  }

  y += 10;

  // Devices table
  doc.font('Helvetica-Bold').fontSize(12).fillColor(VERDE).text('Dispositivos destruidos', X, y);
  y += 20;

  // Table header
  const cols = [X, X + 130, X + 240, X + 360];
  doc.fontSize(9).fillColor('#666');
  doc.font('Helvetica-Bold');
  doc.text('Tipo', cols[0], y);
  doc.text('Marca / Modelo', cols[1], y);
  doc.text('N° Serie', cols[2], y);
  doc.text('Método', cols[3], y);
  y += 14;
  doc.moveTo(X, y).lineTo(X + W, y).strokeColor('#ddd').lineWidth(0.5).stroke();
  y += 6;

  doc.font('Helvetica').fillColor('#333').fontSize(8);
  for (const d of cert.dispositivos) {
    if (y > 720) {
      doc.addPage();
      y = 44;
    }
    doc.text(TIPO_LABEL[d.tipo] || d.tipo, cols[0], y, { width: 125 });
    doc.text([d.marca, d.modelo].filter(Boolean).join(' ') || '—', cols[1], y, { width: 105 });
    doc.text(d.numeroSerie, cols[2], y, { width: 115 });
    doc.text(METODO_LABEL[d.metodo] || d.metodo, cols[3], y, { width: 150 });
    y += Math.max(14, doc.heightOfString(METODO_LABEL[d.metodo] || d.metodo, { width: 150 }) + 4);
    doc.moveTo(X, y).lineTo(X + W, y).strokeColor('#eee').lineWidth(0.3).stroke();
    y += 4;
  }

  y += 10;
  doc.fontSize(9).fillColor('#333').font('Helvetica-Bold').text(`Total de dispositivos: ${cert.dispositivos.length}`, X, y);
  y += 20;

  if (cert.observaciones) {
    doc.font('Helvetica-Bold').fontSize(10).fillColor(VERDE).text('Observaciones', X, y);
    y += 14;
    doc.font('Helvetica').fontSize(9).fillColor('#333').text(cert.observaciones, X, y, { width: W });
    y += doc.heightOfString(cert.observaciones, { width: W }) + 10;
  }

  // Declaración
  y += 10;
  doc.font('Helvetica').fontSize(8).fillColor('#666').text(
    'Se certifica que los dispositivos listados han sido sometidos al proceso de destrucción segura de datos indicado, ' +
    'garantizando la irrecuperabilidad de la información contenida. Este certificado acredita el cumplimiento de las ' +
    'normas de protección de datos personales (Ley 25.326) y la disposición responsable de residuos electrónicos.',
    X, y, { width: W },
  );

  y += 50;
  // Firma
  doc.moveTo(X, y).lineTo(X + 200, y).strokeColor('#333').lineWidth(0.5).stroke();
  doc.fontSize(9).fillColor('#333').text(cert.responsable, X, y + 4);
  doc.fontSize(8).fillColor('#666').text('Responsable de la destrucción', X, y + 16);

  doc.end();
}
