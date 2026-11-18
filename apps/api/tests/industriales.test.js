// Ley 25.612 (residuos industriales): tratamiento por material (arts. 21 y 43 inc. b), registro
// de operaciones de la planta (art. 34) y constancia anual de reciclado para la declaración
// jurada del generador (arts. 11 inc. e y 12).
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setupSeed, NV, LITORAL, EMPRESA, MUNICIPIO } from './helpers.js';

const app = createApp();
let ctx;
let mat;
let cli;
beforeAll(async () => {
  ctx = await setupSeed(app);
  mat = Object.fromEntries((await get(NV, '/materiales?limit=200')).body.items.map((m) => [m.codigo, m]));
  cli = Object.fromEntries((await get(NV, '/clientes')).body.items.map((c) => [c.razonSocial.split(' ')[0], c]));
});
afterAll(() => ctx.teardown());

const get = (email, p) => request(app).get(`/api${p}`).set(ctx.as(email));
const post = (email, p, b) => request(app).post(`/api${p}`).set(ctx.as(email)).send(b);
const anio = new Date().getFullYear();
const pdf = (r) => r.buffer(true).parse((res, cb) => { const c = []; res.on('data', (d) => c.push(d)); res.on('end', () => cb(null, Buffer.concat(c))); });

describe('Tratamiento por material', () => {
  it('se completa solo: reciclado, compostaje o disposición final', async () => {
    expect(mat.CART.tratamiento).toBe('reciclado');
    expect(mat.RECH.tratamiento).toBe('disposicion_final');
    const org = (await post(NV, '/materiales', { codigo: 'ORG', nombre: 'Orgánicos', categoria: 'otros', fraccion: 'organicos' }).expect(201)).body;
    expect(org.tratamiento).toBe('compostaje');
    const vid = (await post(NV, '/materiales', { codigo: 'VIDR', nombre: 'Frascos', categoria: 'vidrio', tratamiento: 'reuso' }).expect(201)).body;
    expect(vid.tratamiento).toBe('reuso');
  });

  it('el certificado dice qué tratamiento recibió cada material', async () => {
    const r = (await post(NV, '/retiros', { cliente: cli.Supermercado._id, items: [{ material: mat.CART._id, pesoEstimadoKg: 40 }, { material: mat.RECH._id, pesoEstimadoKg: 5 }] })).body;
    const cert = (await post(NV, `/retiros/${r._id}/certificado`).expect(201)).body;
    expect(cert.materiales.map((m) => m.tratamiento)).toEqual(['reciclado', 'disposicion_final']);
    const pub = (await request(app).get(`/api/public/certificados/${cert.codigo}`)).body;
    expect(pub.materiales.map((m) => m.destino)).toEqual(['Reciclado', 'Disposición final']);
    await pdf(get(NV, `/certificados/${cert._id}/pdf`)).expect(200);
  });
});

describe('Libro de movimientos (registro de operaciones)', () => {
  it('se exporta a CSV con generador, destino y referencia', async () => {
    const res = await get(NV, `/planta/movimientos/csv?desde=${anio - 1}-01-01`).expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    const lineas = res.text.replace(/^﻿/, '').split('\r\n');
    expect(lineas[0]).toContain('"Etapa (Ley 25.916)"');
    expect(lineas.some((l) => l.includes('"Rechazo a disposición final"') && l.includes('"humedad"'))).toBe(true);
    expect(lineas.some((l) => l.includes('"Venta"') && l.includes('Acopiadora Litoral'))).toBe(true);
    // solo los movimientos de la propia cooperativa
    const litoral = await get(LITORAL, `/planta/movimientos/csv?desde=${anio - 1}-01-01`).expect(200);
    expect(litoral.text).not.toContain('recoleccion_municipal'); // Litoral no recibe el camión municipal
    expect(litoral.text).not.toContain('Hotel Costa Serena'); // cliente solo de Nueva Vida
  });

  it('el chofer no lo puede descargar', async () => {
    const token = (await request(app).post('/api/auth/login').send({ email: 'chofer@nuevavida.local', password: 'chofer1234' })).body.token;
    await request(app).get('/api/planta/movimientos/csv').set('Authorization', `Bearer ${token}`).expect(403);
  });
});

describe('Constancia anual de reciclado', () => {
  it('la cooperativa la descarga en PDF para un cliente', async () => {
    const res = await pdf(get(NV, `/clientes/${cli.Supermercado._id}/constancia-reciclado.pdf?anio=${anio}`)).expect(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.body.subarray(0, 4).toString()).toBe('%PDF');
    // un cliente de otra cooperativa no existe para esta
    const otro = (await get(LITORAL, '/clientes')).body.items[0];
    await get(NV, `/clientes/${otro._id}/constancia-reciclado.pdf`).expect(404);
  });

  it('la empresa ve una constancia por cada cooperativa que la atiende', async () => {
    const { body } = await request(app).get(`/api/v1/portal/constancias?anio=${anio}`).set(ctx.as(EMPRESA)).expect(200);
    expect(body.items.map((c) => c.cooperativa).sort()).toEqual(['Cooperativa Nueva Vida', 'Cooperativa Reciclar del Litoral']);
    const nv = body.items.find((c) => c.cooperativa === 'Cooperativa Nueva Vida');
    expect(nv.kg).toBeGreaterThan(0);
    expect(nv.porTratamiento.reciclado + nv.porTratamiento.disposicion_final).toBeCloseTo(nv.kg, 1);
    await pdf(request(app).get(`/api/v1/portal/constancias/${nv.cliente}.pdf?anio=${anio}`).set(ctx.as(EMPRESA))).expect(200);
    // otra organización no puede bajar la constancia de la empresa
    await request(app).get(`/api/v1/portal/constancias/${nv.cliente}.pdf?anio=${anio}`).set(ctx.as(MUNICIPIO)).expect(404);
  });
});
