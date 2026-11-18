// Da de alta una organización operadora (cooperativa, recicladora o municipio) con su primer administrador.
//
//   npm run crear-cooperativa -- <cuit> "<nombre>" <email-admin> "<nombre-admin>" [corrientes] [provincia] [municipio] [perfil] [tipo]
//   provincia y municipio: claves del paquete @nueva-vida/catalogos (ej. entre_rios parana)
//   perfil: cooperativa, empresa, planta_publica o asociacion (por defecto, según el tipo)
//   tipo: cooperativa (por defecto), recicladora o municipio
//   corrientes habilitadas, separadas por coma (por defecto: rsu). Ej: rsu,regu
//
// La contraseña del admin se genera al azar y se muestra una sola vez.
// También se puede hacer desde la administración de la plataforma (/api/admin).
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { altaOperador } from '../modules/organizations/alta.service.js';
import { normalizarCuit } from '../lib/passwords.js';

const [cuit, nombre, email, nombreAdmin, corrientesArg = 'rsu', provincia, municipio, perfil, tipo = 'cooperativa'] = process.argv.slice(2);
if (!cuit || !nombre || !email || !nombreAdmin) {
  console.error('Uso: npm run crear-cooperativa -- <cuit> "<nombre>" <email-admin> "<nombre-admin>" [rsu,regu,...] [provincia] [municipio] [perfil] [tipo]');
  process.exit(1);
}
const corrientes = corrientesArg.split(',').map((c) => c.trim());
if (corrientes.includes('peligroso')) {
  console.warn('⚠ Corriente "peligroso": la organización debe estar inscripta como operador (Ley 24.051). Cargá el registro en habilitaciones.registros.');
}

await mongoose.connect(env.mongoUri);
try {
  const { org, admin } = await altaOperador({ tipo, nombre, cuit, perfil: perfil || undefined, corrientes, provincia, municipio, admin: { email, nombre: nombreAdmin } });
  console.log(`✓ Organización creada: ${org.nombre} (${org.tipo}, habilitada para: ${corrientes.join(', ')})`);
  console.log(`✓ Admin: ${admin.email}`);
  console.log(`  Contraseña: ${admin.password}`);
  console.log('  Guardala ahora: no se vuelve a mostrar.');
  console.log(`\nSiguiente paso: cargar sus materiales y clientes con npm run importar -- revisar planilla.xlsx --coop ${normalizarCuit(cuit)}`);
} catch (err) {
  console.error(`✗ ${err.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
