// Export a Excel del reporte mensual estilo SNIGEI.
import ExcelJS from 'exceljs';

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function reporteAXlsx(rep, orgNombre) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Nueva Vida';
  wb.created = new Date();

  const resumen = wb.addWorksheet('Resumen');
  resumen.addRow([`Reporte mensual — ${orgNombre}`]).font = { bold: true, size: 14 };
  resumen.addRow([`Período: ${rep.periodo.anio}-${String(rep.periodo.mes).padStart(2, '0')}`]);
  resumen.addRow([]);
  resumen.addRow(['Indicador', 'Valor']).font = { bold: true };
  resumen.addRow(['Total ingresado (kg)', rep.totales.ingresoKg]);
  resumen.addRow(['Total ingresado (tn)', rep.totales.ingresoTn]);
  resumen.addRow(['Total vendido (kg)', rep.totales.ventaKg]);
  resumen.addRow(['A disposición final (kg)', rep.totales.disposicionFinalKg]);
  resumen.addRow(['Recuperado (kg)', rep.totales.recuperadoKg]);
  resumen.addRow(['Tasa de recuperación (%)', rep.totales.tasaRecuperacionPct]);
  resumen.getColumn(1).width = 32;
  resumen.getColumn(2).width = 16;

  const seccion = (nombre, obj, titulo) => {
    const ws = wb.addWorksheet(nombre);
    ws.addRow([titulo]).font = { bold: true, size: 13 };
    ws.addRow([nombre, 'kg']).font = { bold: true };
    for (const [k, v] of Object.entries(obj)) ws.addRow([k, v]);
    ws.getColumn(1).width = 28;
    ws.getColumn(2).width = 16;
  };
  seccion('Corriente', rep.porCorriente, 'Ingresos por corriente');
  seccion('Fracción', rep.porFraccion, 'Ingresos por fracción (RSU)');
  seccion('Tratamiento', rep.porTratamiento, 'Ingresos por tratamiento');
  seccion('Categoría', rep.porCategoria, 'Ingresos por categoría de material');

  const detalle = wb.addWorksheet('Por material');
  detalle.addRow(['Detalle por material']).font = { bold: true, size: 13 };
  detalle.addRow(['Código', 'Nombre', 'Corriente', 'Fracción', 'Tratamiento', 'Ingreso kg', 'Venta kg']).font = { bold: true };
  for (const m of rep.porMaterial) detalle.addRow([m.codigo, m.nombre, m.corriente, m.fraccion || '', m.tratamiento || '', m.ingresoKg, m.ventaKg]);
  [10, 28, 14, 18, 18, 14, 14].forEach((w, i) => (detalle.getColumn(i + 1).width = w));

  return Buffer.from(await wb.xlsx.writeBuffer());
}
