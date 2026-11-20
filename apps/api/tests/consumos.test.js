// Consumos de servicios + combustible + reporte de huella de carbono.
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setupSeed, NV, LITORAL } from './helpers.js';

const app = createApp();
let ctx;
beforeAll(async () => { ctx = await setupSeed(app); });
afterAll(() => ctx.teardown());
const as = (email) => ctx.as(email);

describe('Catálogo de factores', () => {
  it('devuelve los tipos y factores CO2', async () => {
    const r = await request(app).get('/api/consumos/catalogos').set(as(NV)).expect(200);
    expect(r.body.serviciosTipos).toContain('electricidad');
    expect(r.body.combustiblesTipos).toContain('diesel');
    expect(r.body.factoresServicio.electricidad.kgCo2PorUnidad).toBeGreaterThan(0);
  });
});

describe('Consumos de servicios', () => {
  it('crea un consumo y calcula kgCO2 automáticamente', async () => {
    const r = await request(app).post('/api/consumos/servicios').set(as(NV)).send({
      tipo: 'electricidad',
      fecha: '2026-11-15',
      cantidad: 1200,
      importe: 85000,
      proveedor: 'Edenor',
      sede: 'Planta principal',
    }).expect(201);
    expect(r.body.kgCo2).toBeCloseTo(1200 * 0.317, 1);
    expect(r.body.unidad).toBe('kWh');
    expect(r.body.fuenteFactor).toMatch(/SIN|Secretaría/i);
  });
  it('un chofer no puede crear', async () => {
    await request(app).post('/api/consumos/servicios').set(as('chofer@nuevavida.local')).send({ tipo: 'electricidad', fecha: '2026-11-15', cantidad: 10 }).expect(403);
  });
  it('listado filtrado por tipo', async () => {
    await request(app).post('/api/consumos/servicios').set(as(NV)).send({ tipo: 'agua', fecha: '2026-11-10', cantidad: 50 }).expect(201);
    const r = await request(app).get('/api/consumos/servicios?tipo=agua').set(as(NV)).expect(200);
    expect(r.body.items.every((c) => c.tipo === 'agua')).toBe(true);
  });
  it('aislamiento por cooperativa', async () => {
    const nv = (await request(app).get('/api/consumos/servicios').set(as(NV))).body.items.length;
    const lit = (await request(app).get('/api/consumos/servicios').set(as(LITORAL))).body.items.length;
    expect(nv).toBeGreaterThan(0);
    expect(lit).toBe(0);
  });
});

describe('Vehículos y combustible', () => {
  let vehId;
  it('crea vehículo y carga combustible', async () => {
    const v = await request(app).post('/api/consumos/vehiculos').set(as(NV)).send({ patente: 'AB123CD', marca: 'Ford', modelo: 'Cargo', tipoCombustible: 'diesel', capacidadKg: 6000 }).expect(201);
    vehId = v.body._id;
    const c = await request(app).post('/api/consumos/combustibles').set(as(NV)).send({ vehiculo: vehId, fecha: '2026-11-18', cantidad: 80, importe: 72000, kmActual: 45000 }).expect(201);
    expect(c.body.kgCo2).toBeCloseTo(80 * 2.7, 1);
    expect(c.body.tipoCombustible).toBe('diesel');
  });
  it('rechaza patente duplicada en misma coop', async () => {
    await request(app).post('/api/consumos/vehiculos').set(as(NV)).send({ patente: 'AB123CD', tipoCombustible: 'diesel' }).expect(409);
  });
});

describe('Huella de carbono consolidada', () => {
  it('calcula emitido + evitado + neto del mes', async () => {
    const r = await request(app).get('/api/consumos/huella?anio=2026&mes=11').set(as(NV)).expect(200);
    expect(r.body.emitido.totalKg).toBeGreaterThan(0);
    expect(r.body.emitido.porServicio.electricidad).toBeGreaterThan(0);
    expect(r.body.emitido.porCombustible.diesel).toBeGreaterThan(0);
    expect(typeof r.body.evitado.totalKg).toBe('number');
    expect(r.body.netoKg).toBe(Math.round((r.body.evitado.totalKg - r.body.emitido.totalKg) * 100) / 100);
  });
  it('rechaza período inválido', async () => {
    await request(app).get('/api/consumos/huella?anio=2026&mes=13').set(as(NV)).expect(400);
  });
});
