import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { Movimiento } from '../src/modules/movimientos/movimiento.model.js';
import { enterTenant } from '../src/lib/tenancy.js';
import { setupSeed, NV, LITORAL } from './helpers.js';

const app = createApp();
let ctx;
beforeAll(async () => {
  ctx = await setupSeed(app);
});
afterAll(() => ctx.teardown());

const api = (email) => ({
  get: (p) => request(app).get(`/api${p}`).set(ctx.as(email)),
  post: (p, b) => request(app).post(`/api${p}`).set(ctx.as(email)).send(b),
  patch: (p, b) => request(app).patch(`/api${p}`).set(ctx.as(email)).send(b),
  del: (p) => request(app).delete(`/api${p}`).set(ctx.as(email)),
});
const kgDe = async (email, nombre) => (await api(email).get('/planta/stock')).body.items.find((s) => s.material === nombre)?.kg ?? 0;

describe('Corrientes y habilitaciones', () => {
  it('una cooperativa solo RSU no puede dar de alta residuos especiales (REGU)', async () => {
    const regu = { codigo: 'PIL', nombre: 'Pilas', categoria: 'otros', corriente: 'regu', subtipoRegu: 'pilas_baterias' };
    const res = await api(LITORAL).post('/materiales', regu).expect(422);
    expect(res.body.error).toContain('no está habilitada');
    await api(NV).post('/materiales', regu).expect(201); // Nueva Vida está habilitada para REGU
  });

  it('REGU sin tipo es inválido y nadie puede cargar peligrosos sin habilitación', async () => {
    await api(NV).post('/materiales', { codigo: 'X1', nombre: 'Sin tipo', categoria: 'otros', corriente: 'regu' }).expect(400);
    await api(NV).post('/materiales', { codigo: 'X2', nombre: 'Solventes', categoria: 'otros', corriente: 'peligroso' }).expect(422);
  });

  it('la fracción se completa según la categoría y "basura" no es valorizable', async () => {
    const m = (await api(NV).post('/materiales', { codigo: 'TAPAS', nombre: 'Tapitas', categoria: 'plasticos' }).expect(201)).body;
    expect(m).toMatchObject({ corriente: 'rsu', fraccion: 'plasticos', valorizable: true });
    const rech = (await api(NV).get('/materiales?q=RECH')).body.items[0];
    expect(rech).toMatchObject({ fraccion: 'basura', valorizable: false });
  });

  it('no se puede usar un material de otra cooperativa en un retiro', async () => {
    const avuNv = (await api(NV).get('/materiales?q=AVU')).body.items[0];
    const cliLit = (await api(LITORAL).get('/clientes')).body.items[0];
    await api(LITORAL).post('/retiros', { cliente: cliLit._id, items: [{ material: avuNv._id, pesoEstimadoKg: 5 }] }).expect(422);
  });

  it('el certificado incluye la fracción y la cooperativa emisora', async () => {
    const cert = (await api(NV).get('/certificados')).body.items[0];
    const pub = (await request(app).get(`/api/public/certificados/${cert.codigo}`)).body;
    expect(pub.emisor.nombre).toBe('Cooperativa Nueva Vida');
    expect(pub.materiales[0].fraccion).toMatchObject({ codigo: expect.any(String), color: expect.any(String) });
    expect(pub.materiales[0].destino).toBe('Valorización');
  });
});

describe('Libro de movimientos, stock e indicadores', () => {
  let mat, cliente;
  beforeAll(async () => {
    mat = (await api(LITORAL).post('/materiales', { codigo: 'LATA', nombre: 'Latas', categoria: 'metales' })).body;
    cliente = (await api(LITORAL).get('/clientes')).body.items[0];
  });

  it('pesar un retiro suma stock; corregir el peso registra un ajuste', async () => {
    const r = (await api(LITORAL).post('/retiros', { cliente: cliente._id, items: [{ material: mat._id, pesoEstimadoKg: 110 }] })).body;
    expect(await kgDe(LITORAL, 'Latas')).toBe(0); // registrado: todavía no entró a planta
    await api(LITORAL).patch(`/retiros/${r._id}`, { estado: 'en_planta', items: [{ material: mat._id, pesoEstimadoKg: 110, pesoRealKg: 100 }] }).expect(200);
    expect(await kgDe(LITORAL, 'Latas')).toBe(100);
    await api(LITORAL).patch(`/retiros/${r._id}`, { items: [{ material: mat._id, pesoEstimadoKg: 110, pesoRealKg: 90 }] }).expect(200);
    expect(await kgDe(LITORAL, 'Latas')).toBe(90);
    const movs = (await api(LITORAL).get(`/planta/movimientos?material=${mat._id}`)).body.items;
    expect(movs.map((m) => [m.tipo, m.kg])).toEqual([['ajuste', -10], ['ingreso', 100]]);
  });

  it('ingresos de terceros, ventas y rechazos actualizan stock e indicadores', async () => {
    await api(LITORAL).post('/ingresos', { origen: 'recuperador', items: [{ material: mat._id, pesoKg: 50 }] }).expect(201);
    const comprador = (await api(LITORAL).post('/clientes', { tipo: 'comprador', razonSocial: 'Fundición Test' })).body;
    await api(LITORAL).post('/ventas', { comprador: comprador._id, items: [{ material: mat._id, pesoKg: 60, precioKg: 900 }] }).expect(201);
    await api(LITORAL).post('/planta/rechazos', { material: mat._id, kg: 20, motivo: 'Latas con pintura' }).expect(201);
    expect(await kgDe(LITORAL, 'Latas')).toBe(60); // 90 + 50 − 60 − 20

    const { planta } = (await api(LITORAL).get('/dashboard?desde=2000-01-01&hasta=2100-01-01')).body;
    // Litoral también tiene los ingresos de su seed; se controlan las tasas sobre lo que salió de planta
    expect(planta.indicadores.valorizadoKg).toBe(60);
    expect(planta.indicadores.dispuestoKg).toBe(20);
    expect(planta.indicadores.tasaDesvio).toBe(75);
  });

  it('anular un retiro pesado revierte su ingreso', async () => {
    const r = (await api(LITORAL).post('/retiros', { cliente: cliente._id, items: [{ material: mat._id, pesoEstimadoKg: 30, pesoRealKg: 30 }] })).body;
    await api(LITORAL).patch(`/retiros/${r._id}`, { estado: 'en_planta' }).expect(200);
    expect(await kgDe(LITORAL, 'Latas')).toBe(90);
    await api(LITORAL).patch(`/retiros/${r._id}`, { estado: 'anulado' }).expect(200);
    expect(await kgDe(LITORAL, 'Latas')).toBe(60);
  });

  it('ventas e ingresos no se borran ni cambian sus kilos; los ingresos de retiros los crea el sistema', async () => {
    const venta = (await api(LITORAL).get('/ventas')).body.items[0];
    await api(LITORAL).del(`/ventas/${venta._id}`).expect(405);
    const editada = (await api(LITORAL).patch(`/ventas/${venta._id}`, { cobrada: true, items: [] }).expect(200)).body;
    expect(editada.items.length).toBeGreaterThan(0); // `items` se ignora en la edición
    await api(LITORAL).post('/ingresos', { origen: 'retiro', items: [{ material: mat._id, pesoKg: 1 }] }).expect(400);
  });

  it('los movimientos son inmutables', async () => {
    enterTenant(ctx.orgs.litoral._id);
    await expect(Movimiento.updateMany({}, { kg: 0 })).rejects.toThrow(/no se modifican/);
    await expect(Movimiento.deleteMany({})).rejects.toThrow(/no se modifican/);
  });

  it('solo un admin puede hacer ajustes de inventario', async () => {
    const chofer = (await request(app).post('/api/auth/login').send({ email: 'chofer@nuevavida.local', password: 'chofer1234' })).body.token;
    const cart = (await api(NV).get('/materiales?q=CART')).body.items[0];
    await request(app).post('/api/planta/ajustes').set({ Authorization: `Bearer ${chofer}` }).send({ material: cart._id, kg: 5, motivo: 'conteo' }).expect(403);
    await api(NV).post('/planta/ajustes', { material: cart._id, kg: -5, motivo: 'Conteo físico' }).expect(201);
  });
});
