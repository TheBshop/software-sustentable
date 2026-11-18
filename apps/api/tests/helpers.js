import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { seedDatabase, SEED_USUARIOS } from '../src/seed-data.js';

/** Mongo en memoria + datos de ejemplo multi-organización. Devuelve helpers de login. */
export async function setupSeed(app) {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
  const orgs = await seedDatabase();
  const tokens = {};
  for (const u of SEED_USUARIOS) {
    const res = await request(app).post('/api/auth/login').send({ email: u.email, password: u.password });
    tokens[u.email] = res.body.token;
  }
  const as = (email) => ({ Authorization: `Bearer ${tokens[email]}` });
  const teardown = async () => {
    await mongoose.disconnect();
    await mongo.stop();
  };
  return { orgs, tokens, as, teardown };
}

export const NV = 'admin@nuevavida.local';
export const LITORAL = 'admin@litoral.local';
export const EMPRESA = 'empresa@elpuente.local';
export const MUNICIPIO = 'municipio@ejemplo.local';
export const RECICLADORA = 'admin@recicladora.local';
export const MUNI_OPERADOR = 'ambiente@municipiooperador.local';
export const SUPERADMIN = 'superadmin@plataforma.local';
