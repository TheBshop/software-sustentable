import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { Pickup } from '../src/modules/pickups/pickup.model.js';
import { setupSeed, NV, LITORAL, EMPRESA } from './helpers.js';

const app = createApp();
let ctx;
beforeAll(async () => {
  ctx = await setupSeed(app);
});
afterAll(() => ctx.teardown());

const get = (email, path) => request(app).get(`/api${path}`).set(ctx.as(email));

describe('Aislamiento entre cooperativas', () => {
  it('cada cooperativa ve solo sus clientes, retiros, certificados y facturas', async () => {
    const [nvCli, litCli] = await Promise.all([get(NV, '/clientes'), get(LITORAL, '/clientes')]);
    expect(nvCli.body.total).toBe(6);
    expect(litCli.body.total).toBe(1);
    expect(litCli.body.items[0].razonSocial).toBe('Supermercado El Puente SA');

    expect((await get(NV, '/retiros?limit=200')).body.total).toBe(20);
    expect((await get(LITORAL, '/retiros')).body.total).toBe(4);
    expect((await get(LITORAL, '/certificados')).body.items).toHaveLength(3);
    expect((await get(LITORAL, '/facturas')).body.items).toHaveLength(1);
  });

  it('no puede leer, editar ni borrar por ID datos de otra cooperativa', async () => {
    const nvCliente = (await get(NV, '/clientes')).body.items.find((c) => c.razonSocial.startsWith('Hotel'));
    await get(LITORAL, `/clientes/${nvCliente._id}`).expect(404);
    await request(app).patch(`/api/clientes/${nvCliente._id}`).set(ctx.as(LITORAL)).send({ razonSocial: 'Hackeado' }).expect(404);
    await request(app).delete(`/api/clientes/${nvCliente._id}`).set(ctx.as(LITORAL)).expect(404);
    expect((await get(NV, `/clientes/${nvCliente._id}`)).body.razonSocial).toMatch(/^Hotel/);

    const nvCert = (await get(NV, '/certificados')).body.items[0];
    await get(LITORAL, `/certificados/${nvCert._id}/pdf`).expect(404);
    const nvRetiro = (await get(NV, '/retiros')).body.items[0];
    await request(app).post(`/api/retiros/${nvRetiro._id}/certificado`).set(ctx.as(LITORAL)).expect(404);
  });

  it('el dashboard, las alertas y el stock no mezclan datos', async () => {
    const lit = (await get(LITORAL, '/dashboard?desde=2000-01-01&hasta=2100-01-01')).body;
    expect(lit.totales.retiros).toBe(4);
    expect(lit.porCliente).toHaveLength(1);
    expect(lit.porMaterial.map((m) => m.material).sort()).toEqual(['Cartón', 'PET']);

    const alertas = (await get(LITORAL, '/facturas/alertas?dias=30')).body;
    expect([...alertas.vencidas, ...alertas.porVencer]).toHaveLength(1);

    const stock = (await get(LITORAL, '/planta/stock')).body.items;
    expect(stock.map((s) => s.material).sort()).toEqual(['Cartón', 'PET']);
  });

  it('códigos de material y CUIT se pueden repetir entre cooperativas, no dentro de una', async () => {
    // ALU existe en Nueva Vida, no en Litoral
    await request(app).post('/api/materiales').set(ctx.as(LITORAL)).send({ codigo: 'ALU', nombre: 'Aluminio', categoria: 'metales' }).expect(201);
    await request(app).post('/api/materiales').set(ctx.as(LITORAL)).send({ codigo: 'ALU', nombre: 'Otro', categoria: 'metales' }).expect(409);
    // El Puente ya es cliente de Litoral con ese CUIT
    await request(app).post('/api/clientes').set(ctx.as(LITORAL)).send({ razonSocial: 'Duplicado', cuit: '30-71234567-8' }).expect(409);
  });

  it('cada cooperativa tiene su propia numeración', async () => {
    const mat = (await get(LITORAL, '/materiales?q=cart')).body.items[0];
    const cli = (await get(LITORAL, '/clientes')).body.items[0];
    const r = await request(app).post('/api/retiros').set(ctx.as(LITORAL)).send({ cliente: cli._id, items: [{ material: mat._id, pesoEstimadoKg: 10 }] }).expect(201);
    expect(r.body.numero).toBe(5);
  });

  it('un usuario de empresa no accede a la zona de gestión', async () => {
    await get(EMPRESA, '/clientes').expect(403);
    await get(EMPRESA, '/dashboard').expect(403);
    await request(app).post('/api/retiros').set(ctx.as(EMPRESA)).send({}).expect(403);
  });

  it('la verificación pública del QR funciona sin login para cualquier cooperativa', async () => {
    const cert = (await get(LITORAL, '/certificados')).body.items[0];
    const pub = await request(app).get(`/api/public/certificados/${cert.codigo}`).expect(200);
    expect(pub.body.emisor.nombre).toBe('Cooperativa Reciclar del Litoral');
  });

  it('una consulta sin cooperativa en contexto falla en vez de devolver datos de todas', async () => {
    await expect(Pickup.countDocuments()).rejects.toThrow(/sin cooperativa en contexto/);
  });
});
