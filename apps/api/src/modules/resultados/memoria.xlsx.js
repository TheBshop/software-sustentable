// Excel de la memoria anual: una hoja con los totales y una por cada tabla.
import ExcelJS from 'exceljs';

const fmtN = (n) => Number(n ?? 0);

export async function renderMemoriaXlsx(org, m, stream) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Gestión RSU';
  wb.created = new Date();

  const totales = wb.addWorksheet('Totales');
  totales.getCell('A1').value = `Memoria anual ${m.anio}`;
  totales.getCell('A1').font = { bold: true, size: 14 };
  totales.getCell('A2').value = org.nombre;
  if (org.jurisdiccion?.ciudad) totales.getCell('A3').value = org.jurisdiccion.ciudad;
  const filas = [
    ['Concepto', 'Valor', 'Unidad'],
    ['Ingresado a la planta', fmtN(m.totales.ingresadoKg), 'kg'],
    ['Vendido a la industria', fmtN(m.totales.vendidoKg), 'kg'],
    ['A disposición final (rechazo)', fmtN(m.totales.rechazoKg), 'kg'],
    ['Valorización', m.totales.valorizacion ?? '—', '%'],
    ['Facturado por ventas', fmtN(m.totales.monto), '$'],
    ['Huella de carbono (Alcances 1 y 2)', fmtN(m.totales.huellaKg), 'kg CO2e'],
    ['Emisiones evitadas (EPA WARM)', fmtN(m.totales.evitadoKg), 'kg CO2e'],
  ];
  filas.forEach((r, i) => totales.getRow(5 + i).values = r);
  totales.getRow(5).font = { bold: true };
  totales.columns = [{ width: 34 }, { width: 18 }, { width: 12 }];

  const tabla = (nombre, cabeceras, rows) => {
    const h = wb.addWorksheet(nombre);
    h.addRow(cabeceras).font = { bold: true };
    for (const r of rows) h.addRow(r);
    h.columns = cabeceras.map(() => ({ width: 24 }));
  };
  tabla('Por origen', ['Origen', 'Kg'], m.porOrigen.map((o) => [o.origen ?? '—', fmtN(o.kg)]));
  tabla('Por material', ['Material', 'Kg', 'Importe'], m.ventasMaterial.map((v) => [v.material ?? '—', fmtN(v.kg), fmtN(v.monto)]));
  tabla('Compradores', ['Comprador', 'Kg'], m.compradores.map((c) => [c.comprador ?? '—', fmtN(c.kg)]));
  tabla('Rechazo por causa', ['Causa', 'Kg'], m.porCausa.map((c) => [c.causa, fmtN(c.kg)]));
  tabla('Huella mensual', ['Mes', 'Alcance 1 (kg CO2e)', 'Alcance 2 (kg CO2e)', 'Total', 't ingresadas', 'kg CO2e por t'], m.huella.filas.map((f) => [f.mes, fmtN(f.a1), fmtN(f.a2), fmtN(f.total), fmtN(f.t), f.t ? Number((f.a1 + f.a2) / f.t) : '—']));
  tabla('Emisiones evitadas', ['Material', 'Kg vendidos', 'Factor (kg CO2e/kg)', 'Evitado (kg CO2e)'], m.evitadas.filas.map((e) => [e.material, fmtN(e.kg), e.factor?.kg ?? '—', fmtN(e.evitado ?? 0)]));

  await wb.xlsx.write(stream);
  stream.end();
}
