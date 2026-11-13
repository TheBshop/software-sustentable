// Crea un usuario con una contraseña aleatoria y la muestra una sola vez.
// Sirve para el primer administrador en producción (donde no se corre el seed).
//
//   npm run crear-usuario -- admin@coope.org.ar "Nombre Apellido" [rol]
//   roles: admin (por defecto), administracion, operador_planta, chofer
//
// Si el email ya existe, le genera una contraseña nueva (sirve para "olvidé mi contraseña").
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { ROLES } from '../middleware/auth.js';
import { User } from '../modules/users/user.model.js';

const [email, nombre, rol = 'admin'] = process.argv.slice(2);
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('Uso: npm run crear-usuario -- <email> "<nombre>" [rol]');
  process.exit(1);
}
if (!ROLES.includes(rol)) {
  console.error(`Rol inválido. Opciones: ${ROLES.join(', ')}`);
  process.exit(1);
}

// 12 caracteres sin letras confusas (0/O, 1/l), fácil de dictar por teléfono
const ALFABETO = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const password = Array.from(crypto.randomBytes(12), (b) => ALFABETO[b % ALFABETO.length]).join('');

await mongoose.connect(env.mongoUri);
const passwordHash = await User.hashPassword(password);
const existente = await User.findOne({ email: email.toLowerCase() });
if (existente) {
  existente.set({ passwordHash, activo: true, ...(nombre && { nombre }) });
  await existente.save();
  console.log(`✓ Contraseña regenerada para ${existente.email} (${existente.rol})`);
} else {
  if (!nombre) {
    console.error('Para un usuario nuevo falta el nombre: npm run crear-usuario -- <email> "<nombre>" [rol]');
    await mongoose.disconnect();
    process.exit(1);
  }
  await User.create({ email, nombre, rol, passwordHash });
  console.log(`✓ Usuario creado: ${email} (${rol})`);
}
console.log(`  Contraseña: ${password}`);
console.log('  Guardala ahora: no se vuelve a mostrar.');
await mongoose.disconnect();
