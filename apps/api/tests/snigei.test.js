import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setupSeed, NV, LITORAL } from './helpers.js';

const app = createApp();
let ctx;
beforeAll(async () => { ctx = await setupSeed(app); });
afterAll(() => ctx.teardown());
const as = (email) => ctx.as(email);

describe('Reporte mensual SNIGEI', () => {
  it('devuelve totales y agregados del período con datos del seed', async () => {
    const hoy = new Date();
    const r = await request(app).get(`/api/snigei/mensual?anio=${hoy.getUTCFullYear()}&mes=${hoy.getUTCMonth() + 1}`).set(as(NV)).expect(200);
    expect(r.body.totales).toBeTruthy();
    expect(typeof r.body.totales.ingresoKg).toBe('number');
    expect(r.body.totales.tasaRecuperacionPct).toBeGreaterThanOrEqual(0);
    expect(r.body.porCorriente).toBeTruthy();
    expect(Array.isArray(r.body.porMaterial)).toBe(true);
  });

  it('exporta xlsx', async () => {
    const hoy = new Date();
    const r = await request(app).get(`/api/snigei/mensual.xlsx?anio=${hoy.getUTCFullYear()}&mes=${hoy.getUTCMonth() + 1}`).set(as(NV)).buffer(true).parse((res, cb) => { const data = []; res.on('data', (c) => data.push(c)); res.on('end', () => cb(null, Buffer.concat(data))); }).expect(200);
    expect(r.headers['content-type']).toMatch(/spreadsheet/);
    expect(r.body.length).toBeGreaterThan(1000);
  });

  it('respeta el aislamiento: Litoral ve sólo lo suyo', async () => {
    const hoy = new Date();
    const nv = (await request(app).get(`/api/snigei/mensual?anio=${hoy.getUTCFullYear()}&mes=${hoy.getUTCMonth() + 1}`).set(as(NV))).body;
    const lit = (await request(app).get(`/api/snigei/mensual?anio=${hoy.getUTCFullYear()}&mes=${hoy.getUTCMonth() + 1}`).set(as(LITORAL))).body;
    expect(nv.totales.ingresoKg).not.toBe(lit.totales.ingresoKg);
  });

  it('rechaza mes inválido', async () => {
    await request(app).get('/api/snigei/mensual?anio=2026&mes=13').set(as(NV)).expect(400);
  });

  it('un rol no administrativo no puede ver', async () => {
    const hoy = new Date();
    await request(app).get(`/api/snigei/mensual?anio=${hoy.getUTCFullYear()}&mes=${hoy.getUTCMonth() + 1}`).set(ctx.as('chofer@nuevavida.local')).expect(403);
  });
});
