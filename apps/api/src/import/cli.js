// Uso:
//   npm run importar -- plantilla [archivo.xlsx]     genera la planilla vacía para la cooperativa
//   npm run importar -- revisar archivo.xlsx --coop <cuit>         valida y muestra qué se crearía/actualizaría (no escribe)
//   npm run importar -- cargar archivo.xlsx --coop <cuit>          valida y guarda en la base (MONGO_URI)
import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { buildTemplate, parseWorkbook, applyImport } from './importer.js';
import { Organization } from '../modules/organizations/organization.model.js';
import { runWithTenant } from '../lib/tenancy.js';
import { normalizarCuit } from '../lib/passwords.js';

const args = process.argv.slice(2);
const coopIdx = args.indexOf('--coop');
const coopCuit = coopIdx >= 0 ? args.splice(coopIdx, 2)[1] : null;
const [cmd, archivo] = args;

function printErrores(errores) {
  console.error(`\n✗ Se encontraron ${errores.length} error(es). No se guardó nada.\n`);
  for (const e of errores) console.error(`  [${e.hoja}] fila ${e.fila}: ${e.mensaje}`);
  console.error('\nCorregí la planilla y volvé a correr el comando.');
}

if (cmd === 'plantilla') {
  const salida = archivo ?? 'plantilla-carga-nueva-vida.xlsx';
  await buildTemplate().xlsx.writeFile(salida);
  console.log(`✓ Planilla generada: ${salida}`);
} else if (cmd === 'revisar' || cmd === 'cargar') {
  if (!archivo) {
    console.error('Falta el archivo. Ej: npm run importar -- revisar datos.xlsx');
    process.exit(1);
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(archivo);
  const parsed = parseWorkbook(wb);
  if (parsed.errores.length) {
    printErrores(parsed.errores);
    process.exit(1);
  }
  if (!coopCuit) {
    console.error('Falta la cooperativa: agregá --coop <cuit> (los datos se cargan en esa cooperativa)');
    process.exit(1);
  }
  await mongoose.connect(env.mongoUri);
  const coop = await Organization.findOne({ cuit: normalizarCuit(coopCuit), tipo: 'cooperativa' });
  if (!coop) {
    console.error(`No existe una cooperativa con CUIT ${coopCuit}`);
    await mongoose.disconnect();
    process.exit(1);
  }
  const dryRun = cmd === 'revisar';
  const r = await runWithTenant(coop._id, () => applyImport(parsed, { dryRun }));
  console.log(`Cooperativa: ${coop.nombre}`);
  await mongoose.disconnect();
  if (r.errores.length) {
    printErrores(r.errores);
    process.exit(1);
  }
  console.log(`\n${dryRun ? 'Revisión OK (no se guardó nada)' : '✓ Carga completa'}:`);
  console.log(`  Materiales: ${r.materiales.nuevos} nuevos, ${r.materiales.actualizados} actualizados`);
  console.log(`  Clientes:   ${r.clientes.nuevos} nuevos, ${r.clientes.actualizados} actualizados`);
  if (dryRun) console.log('\nPara guardar: npm run importar -- cargar ' + archivo);
} else {
  console.log('Comandos: plantilla [archivo.xlsx] | revisar <archivo.xlsx> | cargar <archivo.xlsx>');
  process.exit(cmd ? 1 : 0);
}
