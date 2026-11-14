import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setupSeed, NV, LITORAL, EMPRESA, MUNICIPIO } from './helpers.js';

const app = createApp();
let ctx;
beforeAll(async () => {
  ctx = await setupSeed(app);
});
afterAll(() => ctx.teardown());

const portal = (email, p) => request(app).get(`/api/v1/portal${p}`).set(ctx.as(email));
const anio = new Date().getFullYear();

describe('Portal de empresa', () => {
  it('ve sus retiros de las dos cooperativas que la atienden, y nada más', async () => {
    const { items } = (await portal(EMPRESA, `/retiros?anio=${anio}`).expect(200)).body;
    const coops = new Set(items.map((r) => r.cooperativa));
    expect(coops).toEqual(new Set(['Cooperativa Nueva Vida', 'Cooperativa Reciclar del Litoral']));
    // El Puente: 6 retiros en Nueva Vida (seed) + 4 en Litoral
    expect(items).toHaveLength(10);
    expect(items[0]).not.toHaveProperty('tarifa');
  });

  it('el resumen suma por cooperativa, material y fracción', async () => {
    const r = (await portal(EMPRESA, `/resumen?anio=${anio}`).expect(200)).body;
    expect(r.totales.retiros).toBe(10);
    expect(r.porCooperativa).toHaveLength(2);
    expect(r.porMaterial.find((m) => m.material === 'Cartón').fraccion.color).toBe('azul');
    expect(r.porMes).toHaveLength(12);
    expect(r.totales.tasaValorizacion).toBe(100);
  });

  it('descarga sus certificados pero no los de otro cliente', async () => {
    const { items } = (await portal(EMPRESA, '/certificados')).body;
    expect(items.length).toBeGreaterThan(0);
    const pdf = await portal(EMPRESA, `/certificados/${items[0].id}/pdf`).buffer(true).expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');

    const ajeno = (await request(app).get('/api/certificados').set(ctx.as(NV))).body.items.find((c) => !c.clienteSnapshot.razonSocial.includes('Puente'));
    await portal(EMPRESA, `/certificados/${ajeno._id}/pdf`).expect(404);
  });

  it('ve sus facturas con saldo y sin las de otros clientes', async () => {
    const { items } = (await portal(EMPRESA, '/facturas')).body;
    expect(items.map((f) => f.cooperativa).sort()).toEqual(['Cooperativa Nueva Vida', 'Cooperativa Reciclar del Litoral']);
    expect(items.find((f) => f.cooperativa === 'Cooperativa Nueva Vida')).toMatchObject({ total: 120000, saldo: 120000, vencida: true });
  });

  it('el detalle retiro por retiro de una liquidación nueva es auditable', async () => {
    const cliente = (await request(app).get('/api/clientes').set(ctx.as(LITORAL))).body.items[0];
    await request(app).post('/api/facturas').set(ctx.as(LITORAL)).send({ cliente: cliente._id, desde: `${anio}-01-01`, hasta: `${anio}-12-31` }).expect(201);
    const f = (await portal(EMPRESA, '/facturas')).body.items.find((x) => x.cooperativa.includes('Litoral') && x.detalle.length);
    expect(f.detalle).toHaveLength(4);
    expect(f.detalle.every((d) => d.importe === 18000 && d.kg > 0)).toBe(true);
    expect(f.detalle.reduce((a, d) => a + d.importe, 0)).toBe(f.total);
  });

  it('descarga el informe anual en PDF', async () => {
    const pdf = await portal(EMPRESA, `/informe-anual.pdf?anio=${anio}`).buffer(true).expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.body.length).toBeGreaterThan(2000);
  });

  it('no accede a la zona de gestión de las cooperativas', async () => {
    await request(app).get('/api/facturas').set(ctx.as(EMPRESA)).expect(403);
    await request(app).get('/api/planta/stock').set(ctx.as(EMPRESA)).expect(403);
  });
});

describe('Portal de municipio', () => {
  it('ve el desglose por sede', async () => {
    const r = (await portal(MUNICIPIO, `/resumen?anio=${anio}`).expect(200)).body;
    expect(r.porSede.map((s) => s.sede.split(' — ')[0]).sort()).toEqual(['Escuela N° 12', 'Palacio municipal', 'Polideportivo']);
    expect(r.porFraccion.some((f) => f.nombre === 'Residuos especiales (REGU)')).toBe(true); // RAEE
    const { sedes } = (await portal(MUNICIPIO, '/organizacion')).body;
    expect(sedes).toHaveLength(3);
  });

  it('no ve datos de la empresa', async () => {
    const { items } = (await portal(MUNICIPIO, `/retiros?anio=${anio}`)).body;
    expect(items.every((r) => r.cooperativa === 'Cooperativa Nueva Vida')).toBe(true);
    expect((await portal(EMPRESA, `/retiros?anio=${anio}`)).body.items.some((r) => r.sede?.includes('Palacio'))).toBe(false);
  });

  it('una cooperativa no puede usar el portal', async () => {
    await portal(NV, '/resumen').expect(403);
  });
});

describe('Dar acceso al portal desde la cooperativa', () => {
  const login = async (email, password) => (await request(app).post('/api/auth/login').send({ email, password })).body;

  it('crea la organización del cliente y un usuario que entra a su portal', async () => {
    const hotel = (await request(app).get('/api/clientes?q=Hotel').set(ctx.as(NV))).body.items[0];
    const res = await request(app)
      .post(`/api/clientes/${hotel._id}/acceso-portal`)
      .set(ctx.as(NV))
      .send({ email: 'martin@hotel.local', nombre: 'Martín' })
      .expect(201);
    expect(res.body).toMatchObject({ organizacion: { nombre: 'Hotel Costa Serena SRL', tipo: 'empresa' }, vinculadaExistente: false });
    expect(res.body.password).toHaveLength(12);

    const sesion = await login('martin@hotel.local', res.body.password);
    expect(sesion.user.organizacion.tipo).toBe('empresa');
    const { items } = (await request(app).get(`/api/v1/portal/retiros?anio=${anio}`).set({ Authorization: `Bearer ${sesion.token}` })).body;
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((r) => r.cooperativa === 'Cooperativa Nueva Vida')).toBe(true);
  });

  it('otra cooperativa con el mismo CUIT se vincula a la misma organización', async () => {
    const cli = (await request(app).post('/api/clientes').set(ctx.as(LITORAL)).send({ razonSocial: 'Hotel Costa Serena SRL', cuit: '30-79876543-2' }).expect(201)).body;
    const res = await request(app).post(`/api/clientes/${cli._id}/acceso-portal`).set(ctx.as(LITORAL)).send({ email: 'otra@hotel.local', nombre: 'Otra persona' }).expect(201);
    expect(res.body.vinculadaExistente).toBe(true);
    expect(res.body.organizacion.nombre).toBe('Hotel Costa Serena SRL');
  });

  it('valida email repetido, compradores y permisos', async () => {
    const clientes = (await request(app).get('/api/clientes').set(ctx.as(NV))).body.items;
    const escuela = clientes.find((c) => c.razonSocial.startsWith('Escuela'));
    const comprador = clientes.find((c) => c.tipo === 'comprador');
    await request(app).post(`/api/clientes/${escuela._id}/acceso-portal`).set(ctx.as(NV)).send({ email: 'martin@hotel.local', nombre: 'Persona' }).expect(409);
    await request(app).post(`/api/clientes/${comprador._id}/acceso-portal`).set(ctx.as(NV)).send({ email: 'c@c.local', nombre: 'Persona' }).expect(422);
    const chofer = (await login('chofer@nuevavida.local', 'chofer1234')).token;
    await request(app).post(`/api/clientes/${escuela._id}/acceso-portal`).set({ Authorization: `Bearer ${chofer}` }).send({ email: 'e@e.local', nombre: 'Persona' }).expect(403);
  });
});
