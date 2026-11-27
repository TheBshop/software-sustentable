import PDFDocument from 'pdfkit';

const VERDE = '#0f766e';
const GRIS = '#374151';

function fmtKg(n) { return Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 1 }); }
function fmtFecha(d) { return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }

export function renderCertificadoVecino(stream, user, perfil, stats) {
  const pdf = new PDFDocument({ size: 'A4', margin: 50 });
  pdf.pipe(stream);

  // Header
  pdf.rect(0, 0, 595, 100).fill(VERDE);
  pdf.fontSize(24).fillColor('#fff').text('Certificado de Reciclaje', 50, 30, { width: 495, align: 'center' });
  pdf.fontSize(12).text('Gestión RSU — gestionrsu.com', 50, 65, { width: 495, align: 'center' });

  let y = 130;

  // Certificamos que...
  pdf.fillColor(GRIS).fontSize(14).font('Helvetica');
  pdf.text('Certificamos que', 50, y, { width: 495, align: 'center' });
  y += 30;

  pdf.fontSize(22).font('Helvetica-Bold').fillColor(VERDE);
  pdf.text(user.nombre ?? 'Vecino/a', 50, y, { width: 495, align: 'center' });
  y += 35;

  if (perfil?.dni) {
    pdf.fontSize(12).font('Helvetica').fillColor(GRIS);
    pdf.text(`DNI: ${perfil.dni}`, 50, y, { width: 495, align: 'center' });
    y += 20;
  }
  if (perfil?.ciudad || perfil?.provincia) {
    pdf.fontSize(12).font('Helvetica').fillColor(GRIS);
    pdf.text([perfil.ciudad, perfil.provincia].filter(Boolean).join(', '), 50, y, { width: 495, align: 'center' });
    y += 20;
  }

  y += 20;
  pdf.fontSize(13).font('Helvetica').fillColor(GRIS);
  pdf.text('ha contribuido activamente a la gestión responsable de residuos sólidos urbanos, realizando las siguientes acciones de identificación y separación de materiales reciclables:', 50, y, { width: 495, align: 'center' });

  y += 60;

  // Stats boxes
  const boxW = 145;
  const gap = 30;
  const startX = 50 + (495 - boxW * 3 - gap * 2) / 2;

  const boxes = [
    [String(stats.identificaciones), 'Identificaciones\nrealizadas'],
    [`${fmtKg(stats.pesoKg)} kg`, 'Material reciclable\nidentificado'],
    [`${fmtKg(stats.co2Kg)} kg`, 'CO₂ evitado\n(estimado)'],
  ];

  for (let i = 0; i < 3; i++) {
    const x = startX + i * (boxW + gap);
    pdf.roundedRect(x, y, boxW, 90, 8).lineWidth(1).strokeColor(VERDE).stroke();
    pdf.fontSize(24).font('Helvetica-Bold').fillColor(VERDE).text(boxes[i][0], x, y + 15, { width: boxW, align: 'center' });
    pdf.fontSize(10).font('Helvetica').fillColor(GRIS).text(boxes[i][1], x, y + 50, { width: boxW, align: 'center' });
  }

  y += 120;

  pdf.fontSize(12).font('Helvetica').fillColor(GRIS);
  pdf.text('Este certificado acredita la participación ciudadana en la separación en origen y la correcta disposición de residuos reciclables, contribuyendo a la economía circular y a la reducción de la huella de carbono.', 50, y, { width: 495, align: 'center' });

  y += 60;
  pdf.fontSize(11).fillColor(GRIS);
  pdf.text(`Fecha de emisión: ${fmtFecha(new Date())}`, 50, y, { width: 495, align: 'center' });

  // Footer
  pdf.fontSize(8).fillColor('#9ca3af').text(
    'Los valores de peso y CO₂ evitado son estimaciones basadas en promedios por tipo de material. ' +
    'Este certificado tiene carácter informativo y no reemplaza certificaciones oficiales. ' +
    'Generado por Gestión RSU — gestionrsu.com',
    50, 760, { width: 495, align: 'center' },
  );

  pdf.end();
  return pdf;
}
