// Exportación a Excel de los reportes contables: una hoja por reporte, encabezados en negrita,
// totales al final y moneda ARS.
import ExcelJS from 'exceljs';

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const ARS = '"$" #,##0.00;[Red]-"$" #,##0.00';
const fecha = (d) => new Date(d).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

/** columnas: [{ header, key, width, money?, date? }] · totales: { key: valor } */
async function hoja(nombre, titulo, columnas, filas, totales) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Nueva Vida';
  wb.created = new Date();
  const ws = wb.addWorksheet(nombre);
  ws.addRow([titulo]).font = { bold: true, size: 13 };
  ws.addRow(columnas.map((c) => c.header)).font = { bold: true };
  columnas.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.width = c.width ?? 16;
    if (c.money) col.numFmt = ARS;
  });
  for (const f of filas) ws.addRow(columnas.map((c) => (c.date ? fecha(f[c.key]) : (f[c.key] ?? ''))));
  ws.addRow(columnas.map((c, i) => (i === 0 ? 'TOTALES' : (totales[c.key] ?? '')))).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 2 }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const rango = (p) => `${fecha(p.desde)} al ${fecha(p.hasta)}`;
const dinero = (header, key) => ({ header, key, width: 16, money: true });
const FECHA = { header: 'Fecha', key: 'fecha', date: true, width: 12 };

export const xlsxLibroVentas = (r) =>
  hoja('Libro IVA Ventas', `Libro IVA Ventas · ${rango(r.periodo)}`, [
    FECHA,
    { header: 'Comprobante', key: 'comprobante', width: 22 },
    { header: 'Cliente', key: 'cliente', width: 30 },
    { header: 'CUIT', key: 'cuit', width: 15 },
    { header: 'Condición IVA', key: 'condicionIva', width: 22 },
    dinero('Neto', 'neto'), dinero('IVA 21 %', 'iva21'), dinero('IVA 10,5 %', 'iva105'), dinero('IVA exento', 'exento'), dinero('Percepciones', 'percepciones'), dinero('Total', 'total'),
  ], r.filas, r.totales);

export const xlsxLibroCompras = (r) =>
  hoja('Libro IVA Compras', `Libro IVA Compras · ${rango(r.periodo)}`, [
    FECHA,
    { header: 'Comprobante', key: 'comprobante', width: 22 },
    { header: 'Proveedor', key: 'proveedor', width: 30 },
    { header: 'CUIT', key: 'cuit', width: 15 },
    { header: 'Condición IVA', key: 'condicionIva', width: 22 },
    dinero('Neto', 'neto'), dinero('IVA 21 %', 'iva21'), dinero('Otros impuestos', 'otrosImpuestos'), dinero('Total', 'total'),
  ], r.filas, r.totales);

export const xlsxMayor = (r) =>
  hoja(`Mayor ${r.cuenta}`, `Mayor de ${r.cuenta} · ${rango(r.periodo)}`, [
    FECHA,
    { header: 'Concepto', key: 'concepto', width: 52 },
    dinero('Debe', 'debe'), dinero('Haber', 'haber'), dinero('Saldo', 'saldo'),
  ], [{ fecha: r.periodo.desde, concepto: 'Saldo inicial', saldo: r.saldoInicial }, ...r.filas], r.totales);
