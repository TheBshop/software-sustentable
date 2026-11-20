// Alta en batch de organizaciones piloto desde un archivo JSON.
//
//   npm run altas-piloto -- pilotos.json
//
// pilotos.json: [{"cuit":"...","nombre":"...","email":"...","nombreAdmin":"...",
//                 "tipo":"cooperativa|municipio","perfil":"...","provincia":"...",
//                 "municipio":"...","corrientes":["rsu","regu"],"notas":"..."}, ...]
//
// Imprime una tabla final con URL + usuario + contraseña de cada uno, lista para WhatsApp.
import mongoose from 'mongoose';
import { readFileSync } from 'node:fs';
import { env } from '../config/env.js';
import { altaOperador } from '../modules/organizations/alta.service.js';
import { Organization } from '../modules/organizations/organization.model.js';
import { mandarInvitacionPiloto } from '../lib/mailer.js';

const archivo = process.argv[2];
if (!archivo) {
  console.error('Uso: npm run altas-piloto -- <archivo.json>');
  process.exit(1);
}

let pilotos;
try { pilotos = JSON.parse(readFileSync(archivo, 'utf8')); }
catch (e) { console.error(`✗ No pude leer ${archivo}: ${e.message}`); process.exit(1); }
if (!Array.isArray(pilotos) || !pilotos.length) {
  console.error('El archivo debe ser un array JSON con al menos un piloto.');
  process.exit(1);
}

await mongoose.connect(env.mongoUri);
const resultados = [];
try {
  for (const p of pilotos) {
    try {
      const { org, admin } = await altaOperador({
        tipo: p.tipo || 'cooperativa',
        nombre: p.nombre,
        cuit: p.cuit,
        perfil: p.perfil || undefined,
        corrientes: p.corrientes || ['rsu'],
        provincia: p.provincia,
        municipio: p.municipio,
        admin: { email: p.email, nombre: p.nombreAdmin },
      });
      await Organization.updateOne({ _id: org._id }, { $set: { piloto: { activo: true, inicio: new Date(), notas: p.notas || '' } } });
      let email;
      try {
        const r = await mandarInvitacionPiloto({ to: admin.email, nombre: p.nombreAdmin, orgNombre: org.nombre, password: admin.password, urlWeb: env.publicWebUrl });
        email = r.enviado ? 'enviado' : 'sin SMTP (pasar a mano)';
      } catch (e) { email = `error (${e.message})`; }
      resultados.push({ nombre: org.nombre, email: admin.email, password: admin.password, mail: email });
      console.log(`✓ ${org.nombre}`);
    } catch (e) {
      resultados.push({ nombre: p.nombre, email: p.email, password: null, mail: `ERROR: ${e.message}` });
      console.log(`✗ ${p.nombre}: ${e.message}`);
    }
  }

  console.log('\n' + '━'.repeat(80));
  console.log('RESUMEN (guardá esto ahora, no se vuelve a mostrar):');
  console.log('━'.repeat(80));
  for (const r of resultados) {
    console.log(`\n${r.nombre}`);
    console.log(`  URL:         ${env.publicWebUrl}/login`);
    console.log(`  Usuario:     ${r.email}`);
    console.log(`  Contraseña:  ${r.password ?? '—'}`);
    console.log(`  Email:       ${r.mail}`);
  }
  console.log('\n' + '━'.repeat(80));
} finally {
  await mongoose.disconnect();
}
