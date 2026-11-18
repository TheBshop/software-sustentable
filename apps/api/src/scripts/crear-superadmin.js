// Crea un administrador de la plataforma (superadmin), que da de alta organizaciones y usuarios.
//   npm run crear-superadmin -- <email> "<nombre>"
// La contraseña se genera al azar y se muestra una sola vez.
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { crearUsuario, organizacionPlataforma } from '../modules/organizations/alta.service.js';

const [email, nombre] = process.argv.slice(2);
if (!email || !nombre) {
  console.error('Uso: npm run crear-superadmin -- <email> "<nombre>"');
  process.exit(1);
}
await mongoose.connect(env.mongoUri);
try {
  const usuario = await crearUsuario({ organizacion: await organizacionPlataforma(), email, nombre, rol: 'superadmin' });
  console.log(`✓ Administrador de la plataforma: ${usuario.email}`);
  console.log(`  Contraseña: ${usuario.password}`);
  console.log('  Guardala ahora: no se vuelve a mostrar.');
} catch (err) {
  console.error(`✗ ${err.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
