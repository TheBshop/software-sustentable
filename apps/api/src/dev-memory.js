// Levanta la API con una MongoDB temporal en memoria y datos de ejemplo.
// No necesita Docker ni Mongo instalado. Los datos se pierden al cortar el proceso.
//   npm run dev:memoria
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { seedDatabase, SEED_USUARIOS } from './seed-data.js';

const mongo = await MongoMemoryServer.create();
await mongoose.connect(mongo.getUri());
await seedDatabase();

createApp().listen(env.port, () => {
  console.log(`API (Mongo en memoria) en http://localhost:${env.port}`);
  console.log('Usuarios de prueba:');
  for (const u of SEED_USUARIOS) console.log(`  ${u.email.padEnd(26)} ${u.password.padEnd(14)} ${u.rol}`);
});

const stop = async () => {
  await mongoose.disconnect();
  await mongo.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
