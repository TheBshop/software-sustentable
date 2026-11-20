// Alta de una organización piloto (lista para que entre su primer admin).
//
//   npm run crear-piloto -- --cuit 30700000016 --nombre "Cooperativa Nueva Vida" \
//     --email admin@nuevavida.coop --nombre-admin "Ana Perez" --tipo cooperativa \
//     --provincia entre_rios --municipio parana --corrientes rsu,regu --notas "Piloto nov/26"
//
// Marca la organización como `piloto.{activo:true, inicio, notas}` para que se vea en el panel de admin.
// La contraseña temporal se imprime: pasala por canal seguro y obligá al cambio en el primer ingreso.
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { altaOperador } from '../modules/organizations/alta.service.js';
import { Organization } from '../modules/organizations/organization.model.js';
import { mandarInvitacionPiloto } from '../lib/mailer.js';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const val = argv[i + 1]?.startsWith('--') ? 'true' : argv[i + 1];
    out[key] = val;
    i += 1;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const requeridos = ['cuit', 'nombre', 'email', 'nombre-admin'];
const faltan = requeridos.filter((k) => !args[k]);
if (faltan.length) {
  console.error('Faltan argumentos:', faltan.map((k) => `--${k}`).join(', '));
  console.error('\nUso:');
  console.error('  npm run crear-piloto -- --cuit <11d> --nombre "..." --email <admin> --nombre-admin "..."');
  console.error('                          [--tipo cooperativa|recicladora|municipio] [--perfil ...]');
  console.error('                          [--provincia <slug>] [--municipio <slug>]');
  console.error('                          [--corrientes rsu,regu,peligroso] [--notas "..."]');
  process.exit(1);
}

const corrientes = (args.corrientes || 'rsu').split(',').map((c) => c.trim()).filter(Boolean);

await mongoose.connect(env.mongoUri);
try {
  const { org, admin } = await altaOperador({
    tipo: args.tipo || 'cooperativa',
    nombre: args.nombre,
    cuit: args.cuit,
    perfil: args.perfil || undefined,
    corrientes,
    provincia: args.provincia,
    municipio: args.municipio,
    admin: { email: args.email, nombre: args['nombre-admin'] },
  });
  await Organization.updateOne(
    { _id: org._id },
    { $set: { piloto: { activo: true, inicio: new Date(), notas: args.notas || '' } } },
  );
  const linea = '━'.repeat(60);
  console.log(`\n${linea}`);
  console.log(`✓ PILOTO creado: ${org.nombre}`);
  console.log(linea);
  console.log(`  CUIT:           ${org.cuit}`);
  console.log(`  Tipo:           ${org.tipo}  (perfil: ${org.perfil})`);
  console.log(`  Corrientes:     ${(org.habilitaciones?.corrientes || []).join(', ')}`);
  console.log(`  Admin email:    ${admin.email}`);
  console.log(`  Contraseña:     ${admin.password}    ← pasarla por canal seguro`);
  if (args.notas) console.log(`  Notas:          ${args.notas}`);
  console.log(linea);

  // Email automático de invitación (si SMTP está configurado).
  try {
    const { enviado } = await mandarInvitacionPiloto({
      to: admin.email,
      nombre: args['nombre-admin'],
      orgNombre: org.nombre,
      password: admin.password,
      urlWeb: env.publicWebUrl,
    });
    if (enviado) console.log(`✓ Email de invitación enviado a ${admin.email}`);
    else console.log(`⚠ SMTP no configurado: mandá la contraseña a mano por WhatsApp o email.`);
  } catch (e) {
    console.log(`⚠ No se pudo enviar el email: ${e.message}. Mandalo a mano.`);
  }

  console.log('\nPróximos pasos:');
  console.log('  1. (Si no salió el email) mandá al admin URL + usuario + contraseña.');
  console.log('  2. Primer ingreso: cambio de contraseña y datos fiscales.');
  console.log('  3. Si va a facturar AFIP, cargar el certificado desde /comercial/afip.');
  console.log(`${linea}\n`);
} catch (err) {
  console.error(`✗ ${err.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
