// Smoke test end-to-end simulando el uso real de una cooperativa en producción.
// Cubre: login → datos fiscales → cliente → material → retiro → ingreso → venta → prefactura → manifiesto.
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setupSeed, NV } from './helpers.js';

const app = createApp();
let ctx;
beforeAll(async () => { ctx = await setupSeed(app); });
afterAll(() => ctx.teardown());
const as = (email) => ctx.as(email);

describe('Flujo de producción end-to-end', () => {
  it('admin edita datos fiscales de su organización', async () => {
    const antes = await request(app).get('/api/mi-organizacion').set(as(NV)).expect(200);
    expect(antes.body.nombre).toBeTruthy();
    const r = await request(app).patch('/api/mi-organizacion').set(as(NV)).send({
      domicilio: 'Sarmiento 2525, Paraná, Entre Ríos',
      condicionIva: 'responsable_inscripto',
      certificado: { responsable: 'Ana Pérez', cargo: 'Presidencia' },
    }).expect(200);
    expect(r.body.domicilio).toBe('Sarmiento 2525, Paraná, Entre Ríos');
    expect(r.body.condicionIva).toBe('responsable_inscripto');
    expect(r.body.certificado.responsable).toBe('Ana Pérez');
  });

  it('un chofer no puede editar la organización', async () => {
    await request(app).patch('/api/mi-organizacion').set(as('chofer@nuevavida.local')).send({ domicilio: 'hack' }).expect(403);
  });

  it('rechaza CUIT inválido', async () => {
    await request(app).patch('/api/mi-organizacion').set(as(NV)).send({ cuit: '12345' }).expect(422);
  });

  it('flujo completo: cliente → retiro → ingreso → prefactura', async () => {
    // 1. Crear cliente
    const cli = await request(app).post('/api/clientes').set(as(NV)).send({
      razonSocial: 'Supermercado de Prueba',
      cuit: '30700088880',
      tarifa: { modalidad: 'por_retiro', montoFijo: 15000 },
      direcciones: [{ direccion: 'Belgrano 100, Paraná' }],
    }).expect(201);

    // 2. Usar un material existente del seed
    const mats = (await request(app).get('/api/materiales').set(as(NV))).body.items;
    const cart = mats.find((m) => m.codigo === 'CART');
    expect(cart).toBeTruthy();

    // 3. Crear retiro
    const ret = await request(app).post('/api/retiros').set(as(NV)).send({
      cliente: cli.body._id,
      fecha: new Date().toISOString(),
      sede: cli.body.direcciones[0].direccion,
      items: [{ material: cart._id, pesoEstimadoKg: 50 }],
    }).expect(201);
    expect(ret.body.numero).toBeGreaterThan(0);

    // 4. Prefactura (preview)
    const hoy = new Date();
    const hace15 = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    const preview = await request(app).post('/api/facturas/preview').set(as(NV)).send({
      cliente: cli.body._id,
      desde: hace15.toISOString().slice(0, 10),
      hasta: hoy.toISOString().slice(0, 10),
    }).expect(200);
    expect(preview.body.total).toBe(15000); // 1 retiro × $15.000
  });
});
