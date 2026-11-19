// Cubre lo nuevo para el lanzamiento piloto: cambio de password, exportar ZIP, estado, health.
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setupSeed, NV } from './helpers.js';

const app = createApp();
let ctx;
beforeAll(async () => { ctx = await setupSeed(app); });
afterAll(() => ctx.teardown());
const as = (email) => ctx.as(email);

describe('Health y estado del sistema', () => {
  it('GET /health responde', async () => {
    const r = await request(app).get('/health').expect(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.mongo).toBe('conectado');
  });

  it('GET /api/estado trae versión, uptime y storage', async () => {
    const r = await request(app).get('/api/estado').set(as(NV)).expect(200);
    expect(r.body.version).toBeTruthy();
    expect(r.body.storage).toBeTruthy();
    expect(typeof r.body.uptimeSegundos).toBe('number');
  });
});

describe('Cambio de contraseña', () => {
  it('rechaza la contraseña actual incorrecta', async () => {
    await request(app).post('/api/auth/cambiar-password').set(as(NV)).send({ actual: 'mal', nueva: 'nuevaclaveok123' }).expect(401);
  });

  it('cambia la contraseña y permite loguear con la nueva', async () => {
    await request(app).post('/api/auth/cambiar-password').set(as(NV)).send({ actual: 'admin1234', nueva: 'nuevaclaveok123' }).expect(200);
    const r = await request(app).post('/api/auth/login').send({ email: NV, password: 'nuevaclaveok123' }).expect(200);
    expect(r.body.token).toBeTruthy();
    expect(r.body.user.debeCambiarPassword).toBe(false);
  });
});

describe('Exportar datos de la organización', () => {
  it('devuelve un ZIP para admin', async () => {
    const r = await request(app).get('/api/mi-organizacion/exportar/datos.zip')
      .set(as(NV))
      .buffer(true)
      .parse((res, cb) => { const data = []; res.on('data', (c) => data.push(c)); res.on('end', () => cb(null, Buffer.concat(data))); })
      .expect(200);
    expect(r.headers['content-type']).toMatch(/zip/);
    expect(r.body.length).toBeGreaterThan(200);
    // Los ZIP empiezan con "PK"
    expect(r.body.slice(0, 2).toString()).toBe('PK');
  });

  it('un chofer no puede exportar', async () => {
    await request(app).get('/api/mi-organizacion/exportar/datos.zip').set(as('chofer@nuevavida.local')).expect(403);
  });
});
