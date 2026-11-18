// Funciones priorizadas a partir del diagnóstico de la cooperativa:
// peso sin balanza, ingreso municipal y calidad de separación, ventas contra el precio de
// mercado, gastos y balance, y certificado con firma, sello y costo.
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setupSeed, NV, EMPRESA } from './helpers.js';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const app = createApp();
let ctx;
let mat;
let cli;
beforeAll(async () => {
  ctx = await setupSeed(app);
  const mats = (await api(NV).get('/materiales?limit=200')).body.items;
  mat = Object.fromEntries(mats.map((m) => [m.codigo, m]));
  cli = Object.fromEntries((await api(NV).get('/clientes')).body.items.map((c) => [c.razonSocial.split(' ')[0], c]));
});
afterAll(() => ctx.teardown());

function api(email) {
  return {
    get: (p) => request(app).get(`/api${p}`).set(ctx.as(email)),
    post: (p, b) => request(app).post(`/api${p}`).set(ctx.as(email)).send(b),
    patch: (p, b) => request(app).patch(`/api${p}`).set(ctx.as(email)).send(b),
  };
}
const chofer = async () => (await request(app).post('/api/auth/login').send({ email: 'chofer@nuevavida.local', password: 'chofer1234' })).body.token;
const kgStock = async (codigo) => (await api(NV).get('/planta/stock')).body.items.find((s) => s.materialId === mat[codigo]._id)?.kg ?? 0;

describe('Peso sin balanza', () => {
  it('un retiro cargado en fardos se convierte a kg con el peso estándar', async () => {
    const r = await api(NV).post('/retiros', { cliente: cli.Supermercado._id, items: [{ material: mat.CART._id, cantidad: 3, unidad: 'Fardo' }, { material: mat.PET._id, pesoEstimadoKg: 10 }] }).expect(201);
    expect(r.body.items[0]).toMatchObject({ pesoEstimadoKg: 180, cantidad: 3, unidad: 'fardo' });
    expect(r.body.items[1].pesoEstimadoKg).toBe(10);
  });

  it('una unidad que el material no tiene da un error claro', async () => {
    const r = await api(NV).post('/retiros', { cliente: cli.Supermercado._id, items: [{ material: mat.CART._id, cantidad: 1, unidad: 'tambor' }] }).expect(422);
    expect(r.body.error).toContain('Unidades: fardo, bolsón');
    await api(NV).post('/retiros', { cliente: cli.Supermercado._id, items: [{ material: mat.CART._id }] }).expect(400);
  });

  it('un ingreso municipal se carga por camiones y queda marcado como estimado', async () => {
    const antes = await kgStock('MEZCLA');
    const r = await api(NV).post('/ingresos', { origen: 'recoleccion_municipal', items: [{ material: mat.MEZCLA._id, cantidad: 1, unidad: 'camión' }] }).expect(201);
    expect(r.body.items[0]).toMatchObject({ pesoKg: 6000, estimado: true });
    expect(await kgStock('MEZCLA')).toBe(antes + 6000);
  });
});

describe('Clasificación y calidad de separación', () => {
  it('clasificar la mezcla mueve kilos a cada material y el rechazo a disposición final', async () => {
    const [mezcla, cart] = [await kgStock('MEZCLA'), await kgStock('CART')];
    await api(NV).post('/planta/clasificacion', { desde: mat.MEZCLA._id, items: [{ material: mat.CART._id, kg: 900 }], rechazoKg: 4000, causa: 'mezclado' }).expect(201);
    expect(await kgStock('MEZCLA')).toBe(mezcla - 4900);
    expect(await kgStock('CART')).toBe(cart + 900);
    await api(NV).post('/planta/clasificacion', { desde: mat.CART._id, items: [{ material: mat.PET._id, kg: 1 }] }).expect(422); // no es mezcla
  });

  it('la calidad por origen muestra la recolección municipal y a cada generador', async () => {
    const { body } = await api(NV).get('/planta/calidad?desde=2000-01-01&hasta=2100-01-01').expect(200);
    const muni = body.origenes.find((o) => o.origen === 'Recolección municipal');
    expect(muni.ingresadoKg).toBeGreaterThan(0);
    expect(muni.causas.mezclado).toBeGreaterThan(0);
    const superm = body.origenes.find((o) => o.origen.startsWith('Supermercado'));
    expect(superm).toMatchObject({ esGenerador: true, causas: { humedad: 140 } });
    expect(body.mezcla.tasaRecuperacion).toBeGreaterThan(0);
    expect(body.mezcla.tasaRecuperacion).toBeLessThan(40);
  });

  it('el generador ve en su portal cuánto de lo que entregó se pudo aprovechar', async () => {
    const r = (await request(app).get(`/api/v1/portal/resumen?anio=${new Date().getFullYear()}`).set(ctx.as(EMPRESA))).body;
    expect(r.separacion.causas.humedad).toBe(140);
    expect(r.separacion.tasaCorrecta).toBeLessThan(100);
  });
});

describe('Ventas contra el precio de referencia', () => {
  it('avisa cuando se vende por debajo del mínimo de mercado', async () => {
    const comprador = cli.Acopiadora._id;
    const debajo = await api(NV).post('/ventas', { comprador, items: [{ material: mat.CART._id, pesoKg: 1000, precioKg: 85 }] }).expect(201);
    expect(debajo.body.avisos).toHaveLength(1);
    expect(debajo.body.avisos[0]).toMatchObject({ referenciaMinKg: 120, diferenciaTotal: 35000 });
    expect(debajo.body.items[0]).toMatchObject({ referenciaMinKg: 120, referenciaMaxKg: 240 });
    const bien = await api(NV).post('/ventas', { comprador, items: [{ material: mat.CART._id, pesoKg: 100, precioKg: 180 }] }).expect(201);
    expect(bien.body.avisos).toEqual([]);
  });

  it('el resumen por comprador muestra precio promedio y ventas por debajo', async () => {
    const { items } = (await api(NV).get('/ventas/resumen')).body;
    const cart = items.find((i) => i.material === 'Cartón' && i.comprador.startsWith('Acopiadora'));
    expect(cart.ventasDebajoDeReferencia).toBeGreaterThanOrEqual(2); // la del seed a $85 y la de este test
    expect(cart.precioPromedioKg).toBeGreaterThan(0);
    expect(cart.referencia.minKg).toBe(120);
  });
});

describe('Gastos y balance', () => {
  it('solo administración ve y carga gastos', async () => {
    await request(app).get('/api/gastos').set({ Authorization: `Bearer ${await chofer()}` }).expect(403);
    await request(app).get('/api/balance').set({ Authorization: `Bearer ${await chofer()}` }).expect(403);
    await api(NV).post('/gastos', { categoria: 'combustible', descripcion: 'Gasoil', monto: 50000 }).expect(201);
    await api(NV).post('/gastos', { categoria: 'inventada', descripcion: 'X', monto: 1 }).expect(400);
  });

  it('el balance suma ventas cobradas y cobros, resta gastos', async () => {
    const b = (await api(NV).get('/balance?desde=2000-01-01&hasta=2100-01-01').expect(200)).body;
    expect(b.egresos.total).toBeGreaterThan(50000);
    expect(b.egresos.porCategoria[0]).toHaveProperty('nombre');
    expect(b.resultado).toBeCloseTo(b.ingresos.total - b.egresos.total, 2);
    expect(b.pendiente.liquidacionesImpagas).toBeGreaterThan(0);
  });

  it('se exporta en CSV para el contador', async () => {
    const r = await api(NV).get('/balance/csv?desde=2000-01-01&hasta=2100-01-01').expect(200);
    expect(r.headers['content-type']).toContain('text/csv');
    expect(r.text.charCodeAt(0)).toBe(0xfeff);
    expect(r.text).toContain('"Resultado"');
    expect(r.text).toContain('"Gasoil"');
  });
});

describe('Certificado con firma, sello y costo', () => {
  it('guarda responsable, firma y sello de la cooperativa', async () => {
    await api(NV).patch('/organizacion', {}).expect(404); // la ruta es /planta/organizacion
    await api(NV).patch('/planta/organizacion', { responsable: 'María Pérez', cargo: 'Presidenta' }).expect(200);
    for (const tipo of ['firma', 'sello']) {
      await request(app).post(`/api/planta/organizacion/${tipo}`).set(ctx.as(NV)).attach('imagen', PNG, { filename: `${tipo}.png`, contentType: 'image/png' }).expect(201);
    }
    await request(app).post('/api/planta/organizacion/otra').set(ctx.as(NV)).attach('imagen', PNG, { filename: 'x.png', contentType: 'image/png' }).expect(404);
    const org = (await api(NV).get('/planta/organizacion')).body;
    expect(org.certificado).toMatchObject({ responsable: 'María Pérez', cargo: 'Presidenta', firmaUrl: expect.stringMatching(/^\/uploads\//), selloUrl: expect.any(String) });
  });

  it('el certificado nuevo lleva firma y el costo del servicio, que no se publica en el QR', async () => {
    const r = (await api(NV).post('/retiros', { cliente: cli.Supermercado._id, items: [{ material: mat.CART._id, pesoEstimadoKg: 50 }] })).body;
    const cert = (await api(NV).post(`/retiros/${r._id}/certificado`).expect(201)).body;
    expect(cert.emisorSnapshot).toMatchObject({ responsable: 'María Pérez', firmaUrl: expect.any(String) });
    expect(cert.costoServicio).toMatchObject({ importe: 15000, modalidad: 'por_retiro' }); // tarifa por retiro del supermercado

    const pdf = await api(NV).get(`/certificados/${cert._id}/pdf`).buffer(true).expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    const pub = await request(app).get(`/api/public/certificados/${cert.codigo}`).expect(200);
    expect(pub.body).not.toHaveProperty('costoServicio');
    await request(app).get(`/api/public/certificados/${cert.codigo}/pdf`).buffer(true).expect(200);
  });
});
