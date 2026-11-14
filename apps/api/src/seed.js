// Borra la base indicada en MONGO_URI y carga datos de ejemplo:  npm run seed
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { seedDatabase, SEED_USUARIOS } from './seed-data.js';

if (env.nodeEnv === 'production') throw new Error('El seed borra la base: no se corre en producción');

await mongoose.connect(env.mongoUri);
await mongoose.connection.dropDatabase();
await seedDatabase();
console.log('Seed OK. Usuarios de prueba:');
for (const u of SEED_USUARIOS) console.log(`  ${u.email.padEnd(26)} ${u.password.padEnd(14)} ${u.rol}`);
await mongoose.disconnect();
