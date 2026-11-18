import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setupSeed, NV, LITORAL, RECICLADORA, MUNI_OPERADOR, EMPRESA } from './helpers.js';

const app = createApp();
let ctx;
beforeAll(async () => {
  ctx = await setupSeed(app);
});
afterAll(() => ctx.teardown());

const as = (email) => ctx.as(email);
const mes = new Date().toISOString().slice(0, 7);
const hoy = new Date().toISOString().slice(0, 10);

describe('Configuración inicial', () => {
  it('guarda jurisdicción, residuos y tratamientos, y valida contra el catálogo', async () => {
    await request(app).patch('/api/planta/organizacion/configuracion').set(as(RECICLADORA)).send({ provincia: 'atlantida' }).expect(400);
    await request(app).patch('/api/planta/organizacion/configuracion').set(as(RECICLADORA)).send({ provincia: 'santa_fe', municipio: 'no_existe' }).expect(400);
    const res = await request(app)
      .patch('/api/planta/organizacion/configuracion')
      .set(as(RECICLADORA))
      .send({ provincia: 'santa_fe', municipio: 'rosario', residuos: ['secos', 'industriales'], corrientes: ['plasticos'], onboarding: true })
      .expect(200);
    expect(res.body.jurisdiccion).toMatchObject({ provincia: 'santa_fe', municipio: 'rosario', ciudad: 'Rosario' });
    const org = await request(app).get('/api/planta/organizacion').set(as(RECICLADORA)).expect(200);
    expect(org.body.configuracion).toMatchObject({ onboarding: true, corrientes: ['plasticos'] });
  });
});

describe('Registros por perfil', () => {
  it('cada perfil ve sus registros', async () => {
    const muni = await request(app).get('/api/registros').set(as(MUNI_OPERADOR)).expect(200);
    expect(muni.body.perfil).toBe('municipio');
    expect(muni.body.definiciones.map((d) => d.id)).toContain('recoleccion');
    const rec = await request(app).get('/api/registros').set(as(RECICLADORA)).expect(200);
    expect(rec.body.perfil).toBe('empresa');
    expect(rec.body.definiciones.map((d) => d.id)).toContain('traslados');
    await request(app).get('/api/registros/recoleccion').set(as(RECICLADORA)).expect(404);
    await request(app).get('/api/registros').set(as(EMPRESA)).expect(403);
  });

  it('valida, guarda, corrige y borra', async () => {
    await request(app).post('/api/registros/recoleccion').set(as(MUNI_OPERADOR)).send({ fecha: hoy, datos: { zona: 'Centro', tipo: 'Inventado', t: 5 } }).expect(400);
    await request(app).post('/api/registros/recoleccion').set(as(MUNI_OPERADOR)).send({ fecha: hoy, datos: { zona: 'Centro', tipo: 'Sin separar', t: -1 } }).expect(400);
    const a = await request(app).post('/api/registros/recoleccion').set(as(MUNI_OPERADOR)).send({ fecha: hoy, datos: { zona: 'Centro', tipo: 'Diferenciada: secos', t: '12.5' } }).expect(201);
    expect(a.body.datos.t).toBe(12.5);
    await request(app).post('/api/registros/recoleccion').set(as(MUNI_OPERADOR)).send({ fecha: hoy, datos: { zona: 'Norte', tipo: 'Sin separar', t: 37.5 } }).expect(201);
    await request(app).post('/api/registros/destino').set(as(MUNI_OPERADOR)).send({ fecha: hoy, datos: { destino: 'Relleno sanitario', t: 40 } }).expect(201);
    await request(app).post('/api/registros/destino').set(as(MUNI_OPERADOR)).send({ fecha: hoy, datos: { destino: 'Planta de clasificación o cooperativa', t: 10 } }).expect(201);
    await request(app).post('/api/registros/costos').set(as(MUNI_OPERADOR)).send({ fecha: hoy, datos: { concepto: 'Recolección', monto: 1000000 } }).expect(201);
    await request(app).post('/api/registros/grandes').set(as(MUNI_OPERADOR)).send({ datos: { razon: 'Hiper SA', rubro: 'Supermercado', kgMes: 4000, inscripto: 'No', separa: 'No' } }).expect(201);
    await request(app).post('/api/registros/grandes').set(as(MUNI_OPERADOR)).send({ datos: { rubro: 'Sin nombre', kgMes: 1, inscripto: 'No', separa: 'No' } }).expect(400);

    await request(app).patch(`/api/registros/recoleccion/${a.body._id}`).set(as(MUNI_OPERADOR)).send({ fecha: hoy, datos: { zona: 'Centro', tipo: 'Diferenciada: secos', t: 12.5 } }).expect(200);
    const lista = await request(app).get(`/api/registros/recoleccion?mes=${mes}`).set(as(MUNI_OPERADOR)).expect(200);
    expect(lista.body.items).toHaveLength(2);

    const defs = await request(app).get(`/api/registros?mes=${mes}`).set(as(MUNI_OPERADOR)).expect(200);
    expect(defs.body.definiciones.find((d) => d.id === 'grandes').filasMes).toBe(1);

    // otra organización no lo ve ni lo puede borrar
    await request(app).delete(`/api/registros/recoleccion/${a.body._id}`).set(as(LITORAL)).expect(404);
  });

  it('el registro mensual no se duplica', async () => {
    const fila = { mes, datos: { personas: 10, formalizadas: 4, diasTrab: 200, ausencias: 6, bajas: 0, ingreso: 300000 } };
    await request(app).post('/api/registros/personal').set(as(RECICLADORA)).send(fila).expect(201);
    await request(app).post('/api/registros/personal').set(as(RECICLADORA)).send(fila).expect(409);
  });
});

describe('Panel', () => {
  it('el municipio ve sus indicadores calculados de los registros', async () => {
    const res = await request(app).get('/api/panel').set(as(MUNI_OPERADOR)).expect(200);
    const k = Object.fromEntries(res.body.kpis.map((x) => [x.id, x.valor]));
    expect(k).toMatchObject({ toneladas: 50, diferenciada: 25, disposicion: 80, costoT: 20000 });
    expect(res.body.avisos.some((a) => a.texto.includes('sin inscribir'))).toBe(true);
    expect(res.body.pasos.find((p) => p.id === 'recoleccion').hecho).toBe(true);
  });

  it('la cooperativa ve planta, ventas y lo que le falta', async () => {
    const res = await request(app).get('/api/panel').set(as(NV)).expect(200);
    expect(res.body.perfil).toBe('cooperativa');
    expect(res.body.kpis.map((x) => x.id)).toEqual(['ingresado', 'vendido', 'ventas', 'rechazo']);
    expect(res.body.pasos.find((p) => p.id === 'configuracion').hecho).toBe(false);
    expect(res.body.avisos[0].link).toBe('/bienvenida');
  });
});
