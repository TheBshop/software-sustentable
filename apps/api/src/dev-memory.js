// Levanta la API con una MongoDB temporal en memoria y datos de ejemplo.
// No necesita Docker ni Mongo instalado. Los datos se pierden al cortar el proceso.
//   npm run dev:memoria
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { seedDatabase, SEED_USUARIOS } from './seed-data.js';
import { crearTodos } from './demo/prototipos.js';
import { runWithoutTenant } from './lib/tenancy.js';

const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
await mongoose.connect(mongo.getUri());
await seedDatabase();
// Con DEMO_MODE=true se cargan además los prototipos de todas las organizaciones relevadas
const prototipos = env.demoMode ? await runWithoutTenant(() => crearTodos({ password: 'demo1234' })) : [];

createApp().listen(env.port, () => {
  console.log(`API (Mongo en memoria) en http://localhost:${env.port}`);
  console.log('Usuarios de prueba:');
  for (const u of SEED_USUARIOS) console.log(`  ${u.email.padEnd(26)} ${u.password.padEnd(14)} ${u.rol}`);
  if (prototipos.length) console.log(`${prototipos.length} prototipos cargados (admin@<slug>.demo / demo1234). Elegilos en http://localhost:5173/demo`);
});

const stop = async () => {
  await mongoose.disconnect();
  await mongo.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
