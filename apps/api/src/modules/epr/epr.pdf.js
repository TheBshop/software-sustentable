import PDFDocument from 'pdfkit';

const VERDE = '#0f766e';
const GRIS = '#374151';

const LABEL_TIPO = {
  pet: 'PET (1)', pead: 'PEAD (2)', pvc: 'PVC (3)', pebd: 'PEBD (4)',
  pp: 'PP (5)', ps: 'PS (6)', otros_plasticos: 'Otros plásticos (7)',
  carton_corrugado: 'Cartón corrugado', carton_compacto: 'Cartón compacto',
  papel: 'Papel', papel_diario: 'Papel diario',
  vidrio_transparente: 'Vidrio transparente', vidrio_color: 'Vidrio color',
  aluminio: 'Aluminio', hojalata: 'Hojalata', acero: 'Acero',
  tetra_pak: 'Tetra Pak', flexible_multicapa: 'Flexible multicapa',
  otro: 'Otro',
};

function fmtFecha(d) {
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtKg(n) {
  return Number(n).toLocaleString('es-AR', { maximumFractionDigits: 1 });
}

export function renderReporteEPR(stream, reporte, org) {
  const pdf = new PDFDocument({ size: 'A4', margin: 50 });
  pdf.pipe(stream);

  // Header
  pdf.rect(0, 0, 595, 80).fill(VERDE);
  pdf.fontSize(22).fillColor('#fff').text('Reporte EPR — Responsabilidad Extendida del Productor', 50, 25, { width: 495 });
  pdf.fontSize(10).text(org?.nombre ?? '', 50, 55);

  pdf.moveDown(2);
  let y = 110;

  // Info block
  pdf.fillColor(GRIS).fontSize(11);
  const info = [
    ['N° Reporte', String(reporte.numero ?? '-')],
    ['Marca / Productor', reporte.marcaSnapshot?.nombre ?? '-'],
    ['CUIT', reporte.marcaSnapshot?.cuit ?? '-'],
    ['Período', `${fmtFecha(reporte.periodo.desde)} al ${fmtFecha(reporte.periodo.hasta)}`],
    ['Fecha de emisión', fmtFecha(new Date())],
    ['Total recuperado', `${fmtKg(reporte.totalKg)} kg`],
    ['CO₂ evitado', `${fmtKg(reporte.co2EvitadoKg)} kg`],
  ];
  for (const [label, val] of info) {
    pdf.font('Helvetica-Bold').text(label + ':', 50, y, { continued: true, width: 200 });
    pdf.font('Helvetica').text(' ' + val);
    y += 18;
  }

  y += 10;
  pdf.font('Helvetica-Bold').fontSize(12).fillColor(VERDE).text('Detalle de materiales recuperados', 50, y);
  y += 20;

  // Table header
  pdf.fontSize(9).fillColor('#fff');
  pdf.rect(50, y, 495, 18).fill(VERDE);
  pdf.text('Tipo de envase', 55, y + 4, { width: 180 });
  pdf.text('Descripción', 240, y + 4, { width: 140 });
  pdf.text('Peso (kg)', 385, y + 4, { width: 70, align: 'right' });
  pdf.text('CO₂ evitado', 460, y + 4, { width: 80, align: 'right' });
  y += 18;

  // Table rows
  pdf.fillColor(GRIS).font('Helvetica');
  for (const l of reporte.lineas) {
    if (y > 720) { pdf.addPage(); y = 50; }
    const bg = reporte.lineas.indexOf(l) % 2 === 0 ? '#f5f7f8' : '#fff';
    pdf.rect(50, y, 495, 18).fill(bg);
    pdf.fillColor(GRIS);
    pdf.text(LABEL_TIPO[l.tipoEnvase] ?? l.tipoEnvase, 55, y + 4, { width: 180 });
    pdf.text(l.descripcion ?? '', 240, y + 4, { width: 140 });
    pdf.text(fmtKg(l.pesoKg), 385, y + 4, { width: 70, align: 'right' });
    pdf.text(l.co2EvitadoKg ? fmtKg(l.co2EvitadoKg) : '-', 460, y + 4, { width: 80, align: 'right' });
    y += 18;
  }

  // Cadenas de custodia
  if (reporte.cadenasCustodia?.length) {
    y += 15;
    pdf.font('Helvetica-Bold').fontSize(11).fillColor(VERDE).text('Cadena de custodia', 50, y);
    y += 16;
    pdf.font('Helvetica').fontSize(10).fillColor(GRIS);
    for (const c of reporte.cadenasCustodia) {
      pdf.text(`• ${c}`, 55, y, { width: 480 });
      y += 14;
    }
  }

  // Procesos
  if (reporte.procesosAplicados?.length) {
    y += 10;
    pdf.font('Helvetica-Bold').fontSize(11).fillColor(VERDE).text('Procesos aplicados', 50, y);
    y += 16;
    pdf.font('Helvetica').fontSize(10).fillColor(GRIS);
    for (const p of reporte.procesosAplicados) {
      pdf.text(`• ${p}`, 55, y, { width: 480 });
      y += 14;
    }
  }

  // Puntos de recuperación
  if (reporte.puntosRecuperacion?.length) {
    y += 10;
    pdf.font('Helvetica-Bold').fontSize(11).fillColor(VERDE).text('Puntos de recuperación', 50, y);
    y += 16;
    pdf.font('Helvetica').fontSize(10).fillColor(GRIS);
    for (const p of reporte.puntosRecuperacion) {
      pdf.text(`• ${p.nombre ?? ''} — ${p.direccion ?? ''}`, 55, y, { width: 480 });
      y += 14;
    }
  }

  // Observaciones
  if (reporte.observaciones) {
    y += 10;
    pdf.font('Helvetica-Bold').fontSize(11).fillColor(VERDE).text('Observaciones', 50, y);
    y += 16;
    pdf.font('Helvetica').fontSize(10).fillColor(GRIS).text(reporte.observaciones, 55, y, { width: 480 });
  }

  // Footer legal
  if (y > 680) pdf.addPage();
  pdf.fontSize(8).fillColor('#9ca3af').text(
    'Este reporte documenta la recuperación de envases post-consumo en el marco de la Responsabilidad Extendida del Productor (REP/EPR). ' +
    'Los datos provienen de los registros operativos de la organización emisora y tienen carácter informativo. ' +
    'Generado por Gestión RSU — gestionrsu.com',
    50, 760, { width: 495, align: 'center' },
  );

  pdf.end();
  return pdf;
}
