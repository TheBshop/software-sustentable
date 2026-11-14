// Da de alta una cooperativa en la plataforma con su primer administrador.
//
//   npm run crear-cooperativa -- <cuit> "<nombre>" <email-admin> "<nombre-admin>" [corrientes]
//   corrientes habilitadas, separadas por coma (por defecto: rsu). Ej: rsu,regu
//
// La contraseña del admin se genera al azar y se muestra una sola vez.
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Organization, CORRIENTES } from '../modules/organizations/organization.model.js';
import { User } from '../modules/users/user.model.js';
import { randomPassword, normalizarCuit } from '../lib/passwords.js';

const [cuit, nombre, email, nombreAdmin, corrientesArg = 'rsu'] = process.argv.slice(2);
if (!cuit || !nombre || !email || !nombreAdmin) {
  console.error('Uso: npm run crear-cooperativa -- <cuit> "<nombre>" <email-admin> "<nombre-admin>" [rsu,regu,...]');
  process.exit(1);
}
const corrientes = corrientesArg.split(',').map((c) => c.trim());
const invalidas = corrientes.filter((c) => !CORRIENTES.includes(c));
if (invalidas.length) {
  console.error(`Corrientes inválidas: ${invalidas.join(', ')}. Opciones: ${CORRIENTES.join(', ')}`);
  process.exit(1);
}
if (corrientes.includes('peligroso')) {
  console.warn('⚠ Corriente "peligroso": la cooperativa debe estar inscripta como operador (Ley 24.051). Cargá el registro en habilitaciones.registros.');
}

await mongoose.connect(env.mongoUri);
try {
  if (await Organization.exists({ cuit: normalizarCuit(cuit) })) throw new Error(`Ya existe una organización con CUIT ${cuit}`);
  if (await User.exists({ email: email.toLowerCase() })) throw new Error(`Ya existe un usuario con email ${email}`);
  const coop = await Organization.create({ tipo: 'cooperativa', nombre, cuit: normalizarCuit(cuit), habilitaciones: { corrientes } });
  const password = randomPassword();
  await User.create({ nombre: nombreAdmin, email, rol: 'admin', organizacion: coop._id, passwordHash: await User.hashPassword(password) });
  console.log(`✓ Cooperativa creada: ${nombre} (habilitada para: ${corrientes.join(', ')})`);
  console.log(`✓ Admin: ${email}`);
  console.log(`  Contraseña: ${password}`);
  console.log('  Guardala ahora: no se vuelve a mostrar.');
  console.log(`\nSiguiente paso: cargar sus materiales y clientes con npm run importar -- revisar planilla.xlsx --coop ${normalizarCuit(cuit)}`);
} catch (err) {
  console.error(`✗ ${err.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
