// Crea un usuario con una contraseña aleatoria y la muestra una sola vez.
//
//   npm run crear-usuario -- <email> "<nombre>" <rol> <cuit-de-la-organización>
//   roles de cooperativa: admin, administracion, operador_planta, chofer
//   roles de empresa/municipio: cliente_admin, cliente
//
// Si el email ya existe, le genera una contraseña nueva (sirve para "olvidé mi contraseña"):
//   npm run crear-usuario -- <email>
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { rolesPara } from '../middleware/auth.js';
import { User } from '../modules/users/user.model.js';
import { Organization } from '../modules/organizations/organization.model.js';
import { randomPassword, normalizarCuit } from '../lib/passwords.js';

const [email, nombre, rol, cuitOrg] = process.argv.slice(2);
const salir = async (msg) => {
  console.error(msg);
  await mongoose.disconnect();
  process.exit(1);
};

if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('Uso: npm run crear-usuario -- <email> "<nombre>" <rol> <cuit-organización>');
  process.exit(1);
}

await mongoose.connect(env.mongoUri);
const password = randomPassword();
const passwordHash = await User.hashPassword(password);
const existente = await User.findOne({ email: email.toLowerCase() }).populate('organizacion');

if (existente) {
  existente.set({ passwordHash, activo: true, ...(nombre && { nombre }) });
  await existente.save();
  console.log(`✓ Contraseña regenerada para ${existente.email} (${existente.rol} · ${existente.organizacion?.nombre})`);
} else {
  if (!nombre || !rol || !cuitOrg) await salir('Para un usuario nuevo: npm run crear-usuario -- <email> "<nombre>" <rol> <cuit-organización>');
  const org = await Organization.findOne({ cuit: normalizarCuit(cuitOrg) });
  if (!org) await salir(`No existe una organización con CUIT ${cuitOrg}. Para una cooperativa nueva: npm run crear-cooperativa`);
  if (!rolesPara(org.tipo).includes(rol)) await salir(`Rol inválido para ${org.tipo}. Opciones: ${rolesPara(org.tipo).join(', ')}`);
  await User.create({ email, nombre, rol, organizacion: org._id, passwordHash });
  console.log(`✓ Usuario creado: ${email} (${rol} · ${org.nombre})`);
}
console.log(`  Contraseña: ${password}`);
console.log('  Guardala ahora: no se vuelve a mostrar.');
await mongoose.disconnect();
