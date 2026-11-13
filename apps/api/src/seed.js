// Borra la base indicada en MONGO_URI y carga datos de ejemplo:  npm run seed
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { seedDatabase } from './seed-data.js';

if (env.nodeEnv === 'production') throw new Error('El seed borra la base: no se corre en producción');

await mongoose.connect(env.mongoUri);
await mongoose.connection.dropDatabase();
await seedDatabase();
console.log('Seed OK → admin@nuevavida.local / admin1234');
await mongoose.disconnect();
