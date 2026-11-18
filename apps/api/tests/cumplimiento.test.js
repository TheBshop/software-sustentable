import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setupSeed, NV, RECICLADORA, MUNI_OPERADOR } from './helpers.js';

const app = createApp();
let ctx;
beforeAll(async () => {
  ctx = await setupSeed(app);
});
afterAll(() => ctx.teardown());

const as = (email) => ctx.as(email);
const dia = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

describe('Matriz de cumplimiento', () => {
  it('se arma según perfil, jurisdicción y corrientes; el municipio no tiene matriz', async () => {
    const nv = await request(app).get('/api/cumplimiento').set(as(NV)).expect(200);
    expect(nv.body.perfil).toBe('cooperativa');
    const ids = nv.body.items.map((i) => i.id);
    expect(ids).toContain('ambiental'); // registral base
    expect(ids).toContain('remitos'); // documental auto
    expect(ids).toContain('epp'); // laboral auto
    expect(ids).toContain('inaes'); // sociedad cooperativa
    expect(ids).not.toContain('reg_pel'); // Nueva Vida no trata peligrosos

    await request(app).patch('/api/planta/organizacion/configuracion').set(as(NV)).send({ corrientes: ['plasticos', 'baterias_litio'] }).expect(200);
    const con = (await request(app).get('/api/cumplimiento').set(as(NV))).body;
    const nuevos = con.items.map((i) => i.id);
    expect(nuevos).toContain('reg_pel'); // ahora sí
    expect(nuevos).toContain('simel'); // trazabilidad peligrosos

    const empresa = (await request(app).get('/api/cumplimiento').set(as(RECICLADORA))).body;
    expect(empresa.perfil).toBe('empresa');
    expect(empresa.items.map((i) => i.id)).toContain('societario'); // no INAES
    expect(empresa.items.map((i) => i.id)).toContain('compras_resp');

    const muni = (await request(app).get('/api/cumplimiento').set(as(MUNI_OPERADOR))).body;
    expect(muni.items).toEqual([]);
  });

  it('calcula evidencia automática: remitos correlativos, balance de masa, EPP del año', async () => {
    const r = (await request(app).get('/api/cumplimiento').set(as(NV))).body;
    const remitos = r.items.find((i) => i.id === 'remitos');
    expect(remitos.tipo).toBe('auto');
    expect(remitos.estado.codigo).toBe('sin_dato');
    expect(remitos.estado.txt).toContain('Todavía no hay remitos');

    const epp = r.items.find((i) => i.id === 'epp');
    expect(epp.estado.codigo).toBe('no_cumple');

    // cargar un EPP del año: pasa a cumple
    const anio = new Date().toISOString().slice(0, 10);
    await request(app).post('/api/registros/epp').set(as(NV)).send({ fecha: anio, datos: { persona: 'Ana', elementos: 'Guantes y faja' } }).expect(201);
    const r2 = (await request(app).get('/api/cumplimiento').set(as(NV))).body;
    expect(r2.items.find((i) => i.id === 'epp').estado.codigo).toBe('cumple');

    // resumen por área con cumplimiento ok/total
    const reg = r2.areas.find((a) => a.area === 'lab');
    expect(reg.total).toBeGreaterThan(0);
    expect(reg.ok).toBeGreaterThanOrEqual(1);
  });
});

describe('Evidencia manual', () => {
  it('se carga con número y vencimiento, y la matriz refleja el estado', async () => {
    await request(app).put('/api/cumplimiento/evidencias/ambiental').set(as(NV)).send({ numero: 'CAA-12345', vence: dia(60), notas: 'Renovar en noviembre' }).expect(200);
    const r = (await request(app).get('/api/cumplimiento').set(as(NV))).body.items.find((i) => i.id === 'ambiental');
    expect(r.estado.codigo).toBe('cumple');
    expect(r.numero).toBe('CAA-12345');

    // Vence pronto
    await request(app).put('/api/cumplimiento/evidencias/ambiental').set(as(NV)).send({ numero: 'CAA-12345', vence: dia(10) }).expect(200);
    expect((await request(app).get('/api/cumplimiento').set(as(NV))).body.items.find((i) => i.id === 'ambiental').estado.codigo).toBe('vence_pronto');

    // Vencida
    await request(app).put('/api/cumplimiento/evidencias/ambiental').set(as(NV)).send({ numero: 'CAA-12345', vence: dia(-5) }).expect(200);
    expect((await request(app).get('/api/cumplimiento').set(as(NV))).body.items.find((i) => i.id === 'ambiental').estado.codigo).toBe('vencido');

    // El panel la ve como aviso
    const panel = (await request(app).get('/api/panel').set(as(NV))).body;
    expect(panel.avisos.some((a) => a.texto.includes('venció') && a.tono === 'red')).toBe(true);

    await request(app).delete('/api/cumplimiento/evidencias/ambiental').set(as(NV)).expect(204);
    expect((await request(app).get('/api/cumplimiento').set(as(NV))).body.items.find((i) => i.id === 'ambiental').estado.codigo).toBe('sin_cargar');
  });
});

describe('Autodiagnóstico', () => {
  it('se arma del catálogo DIAG y resume el cumplimiento', async () => {
    const d = await request(app).get('/api/cumplimiento/autodiagnostico').set(as(NV)).expect(200);
    expect(d.body.grupos.length).toBeGreaterThan(0);
    const total = d.body.resumen.total;
    const uno = d.body.grupos[0].items[0];
    await request(app).put(`/api/cumplimiento/autodiagnostico/${uno.id}`).set(as(NV)).send({ cumple: true }).expect(200);
    await request(app).put(`/api/cumplimiento/autodiagnostico/${d.body.grupos[0].items[1].id}`).set(as(NV)).send({ cumple: false, notas: 'Vencido' }).expect(200);
    const d2 = (await request(app).get('/api/cumplimiento/autodiagnostico').set(as(NV))).body;
    expect(d2.resumen).toMatchObject({ cumple: 1, no: 1, sinResponder: total - 2, total });
    expect(d2.grupos[0].items[1].notas).toBe('Vencido');
  });
});
