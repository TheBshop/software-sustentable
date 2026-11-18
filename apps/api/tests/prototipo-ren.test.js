// Prototipo REN (Cooperativa RAEE, Neuquén): verifica que se arme completo con sus materiales
// RAEE, corrientes correctas y datos de ejemplo cargados.
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { crearPrototipo } from '../src/demo/prototipos.js';
import { runWithoutTenant } from '../src/lib/tenancy.js';

const app = createApp();
let mongo;
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
}, 60000);
afterAll(async () => { await mongoose.disconnect(); await mongo.stop(); });

describe('Prototipo REN (RAEE)', () => {
  let token;
  it('crea la cooperativa con sus materiales RAEE y datos de ejemplo', async () => {
    const { org, emails } = await runWithoutTenant(() =>
      crearPrototipo('cooperativa-ren', { password: 'test-ren-1234', conDatos: true }),
    );
    expect(org.nombre).toBe('Cooperativa de Trabajo REN');
    expect(org.jurisdiccion.provincia).toBe('neuquen');
    expect(org.habilitaciones.corrientes).toEqual(expect.arrayContaining(['rsu', 'regu', 'peligroso']));
    const login = await request(app).post('/api/auth/login').send({ email: emails.admin, password: 'test-ren-1234' }).expect(200);
    token = login.body.token;
  });

  it('tiene materiales RAEE específicos (notebook, celular, placa, cable, cobre, batería)', async () => {
    const r = await request(app).get('/api/materiales?limit=200').set({ Authorization: `Bearer ${token}` }).expect(200);
    const codigos = r.body.items.map((m) => m.codigo);
    for (const c of ['NOTE', 'CELU', 'MONI', 'PLAQ', 'CABLE', 'COBRE', 'BATLI']) expect(codigos).toContain(c);
    const bat = r.body.items.find((m) => m.codigo === 'BATLI');
    expect(bat.corriente).toBe('peligroso');
    const note = r.body.items.find((m) => m.codigo === 'NOTE');
    expect(note.corriente).toBe('regu');
    expect(note.subtipoRegu).toBe('raee');
  });

  it('cargó retiros y clientes de ejemplo', async () => {
    const clientes = await request(app).get('/api/clientes?limit=50').set({ Authorization: `Bearer ${token}` }).expect(200);
    expect(clientes.body.items.length).toBeGreaterThan(0);
    const retiros = await request(app).get('/api/retiros?limit=50').set({ Authorization: `Bearer ${token}` }).expect(200);
    expect(retiros.body.items.length).toBeGreaterThan(0);
  });
});
