// Crea el prototipo de una organización relevada (ver src/demo/entidades.js) en la base
// configurada en MONGO_URI, para que lo pruebe con sus propios datos.
//
//   npm run crear-prototipo -- <slug>            con datos de ejemplo
//   npm run crear-prototipo -- <slug> --vacio    sin datos de ejemplo (para cargar los reales)
//   npm run crear-prototipo -- --lista           muestra los prototipos disponibles
//
// La contraseña se genera al azar y se muestra una sola vez.
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { randomPassword } from '../lib/passwords.js';
import { runWithoutTenant } from '../lib/tenancy.js';
import { ENTIDADES } from '../demo/entidades.js';
import { crearPrototipo } from '../demo/prototipos.js';

const args = process.argv.slice(2);
if (!args.length || args.includes('--lista')) {
  for (const e of ENTIDADES) console.log(`${e.slug.padEnd(30)} ${e.nombre} (${e.ciudad})`);
  if (!args.length) console.log('\nUso: npm run crear-prototipo -- <slug> [--vacio]');
  process.exit(0);
}

await mongoose.connect(env.mongoUri);
try {
  const password = randomPassword();
  const { org, emails } = await runWithoutTenant(() => crearPrototipo(args[0], { password, conDatos: !args.includes('--vacio') }));
  console.log(`✓ Prototipo creado: ${org.nombre}`);
  console.log(`  Corrientes habilitadas (a confirmar con la organización): ${org.habilitaciones.corrientes.join(', ')}`);
  console.log(`  Admin:  ${emails.admin}`);
  console.log(`  Chofer: ${emails.chofer}`);
  console.log(`  Contraseña (de los dos): ${password}`);
  console.log('  Guardala ahora: no se vuelve a mostrar. Cambiá los emails por los reales antes de entregarlo.');
} catch (err) {
  console.error(`✗ ${err.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
