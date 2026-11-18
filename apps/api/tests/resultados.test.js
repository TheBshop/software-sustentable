import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setupSeed, NV, LITORAL } from './helpers.js';

const app = createApp();
let ctx;
const anio = new Date().getFullYear();
beforeAll(async () => {
  ctx = await setupSeed(app);
});
afterAll(() => ctx.teardown());

const as = (email) => ctx.as(email);
const mes = () => new Date().toISOString().slice(0, 7);

describe('Huella de carbono', () => {
  it('suma combustibles (Alcance 1) y electricidad (Alcance 2) de los registros', async () => {
    await request(app).post('/api/registros/combustible').set(as(NV)).send({ fecha: `${mes()}-05`, datos: { combustible: 'Gasoil', litros: 100, monto: 100000 } }).expect(201);
    await request(app).post('/api/registros/electricidad').set(as(NV)).send({ fecha: `${mes()}-10`, datos: { kwh: 2000, monto: 300000, comprobante: 'A-123' } }).expect(201);
    const r = await request(app).get(`/api/resultados/huella?anio=${anio}`).set(as(NV)).expect(200);
    expect(r.body.total.a1).toBeGreaterThan(200); // 100 L × ~2.34
    expect(r.body.total.a2).toBeGreaterThan(400); // 2000 kWh × factor
    expect(r.body.total.kg).toBeCloseTo(r.body.total.a1 + r.body.total.a2, 1);
    expect(r.body.fuente.nombre).toContain('SNIGEI-AR');
    expect(r.body.filas.length).toBeGreaterThan(0);
  });
});

describe('Emisiones evitadas', () => {
  it('aplica WARM a cada material vendido con factor', async () => {
    const r = await request(app).get(`/api/resultados/evitadas?anio=${anio}`).set(as(NV)).expect(200);
    const carton = r.body.filas.find((f) => f.material?.startsWith('Cartón'));
    expect(carton).toBeTruthy();
    expect(carton.factor.kg).toBeCloseTo(3.46, 1);
    expect(carton.evitado).toBeGreaterThan(0);
    expect(r.body.total.evitadoKg).toBeGreaterThan(0);
    expect(r.body.fuente.nombre).toContain('WARM');
  });
});

describe('Informe por cliente', () => {
  it('agrega por generador los kg retirados y los certificados', async () => {
    const r = await request(app).get(`/api/resultados/informe-clientes?anio=${anio}`).set(as(NV)).expect(200);
    expect(r.body.items.length).toBeGreaterThan(0);
    const uno = r.body.items[0];
    expect(uno.cliente).toBeTruthy();
    expect(uno.kgTotal).toBeGreaterThan(0);
    expect(uno.materiales.length).toBeGreaterThan(0);
  });
});

describe('Memoria anual', () => {
  it('reúne totales, orígenes, ventas, rechazos y huella', async () => {
    const r = await request(app).get(`/api/resultados/memoria?anio=${anio}`).set(as(NV)).expect(200);
    expect(r.body.totales.ingresadoKg).toBeGreaterThan(0);
    expect(r.body.totales.vendidoKg).toBeGreaterThan(0);
    expect(r.body.totales.valorizacion).toBeGreaterThan(0);
    expect(r.body.ventasMaterial.length).toBeGreaterThan(0);
    expect(r.body.porOrigen.length).toBeGreaterThan(0);
    expect(r.body.totales.huellaKg).toBeGreaterThan(0);
    expect(r.body.totales.evitadoKg).toBeGreaterThan(0);
  });

  it('exporta como PDF y como Excel', async () => {
    const pdf = await request(app).get(`/api/resultados/memoria.pdf?anio=${anio}`).set(as(NV)).expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.body.length).toBeGreaterThan(400);

    const xlsx = await request(app).get(`/api/resultados/memoria.xlsx?anio=${anio}`).buffer(true).parse((res, cb) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    }).set(as(NV)).expect(200);
    expect(xlsx.headers['content-type']).toContain('spreadsheet');
    // Firma del zip de xlsx
    expect(xlsx.body.slice(0, 2).toString()).toBe('PK');
  });

  it('otra organización ve su propia memoria, no la de Nueva Vida', async () => {
    const r = await request(app).get(`/api/resultados/memoria?anio=${anio}`).set(as(LITORAL)).expect(200);
    expect(r.body.totales.vendidoKg).toBe(0);
  });
});
