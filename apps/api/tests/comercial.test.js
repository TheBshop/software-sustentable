import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setupSeed, NV, LITORAL } from './helpers.js';
import { cuitValido } from '../src/lib/cuit.js';

const app = createApp();
let ctx;
let mats;
let comprador;
let sinCompras;
beforeAll(async () => {
  ctx = await setupSeed(app);
  mats = (await request(app).get('/api/materiales?limit=200').set(ctx.as(NV))).body.items.filter((m) => !m.mezcla && m.corriente === 'rsu');
  comprador = (await request(app).get('/api/clientes?tipo=comprador').set(ctx.as(NV))).body.items[0];
  const stock = (await request(app).get('/api/comercial/stock').set(ctx.as(NV))).body.items;
  sinCompras = mats.find((m) => !stock.some((s) => s.materialId === m._id && s.compradoKg > 0));
});
afterAll(() => ctx.teardown());

const as = (email) => ctx.as(email);
const dia = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const mes = dia(0).slice(0, 7);

describe('CUIT', () => {
  it('controla el dígito verificador', () => {
    expect(cuitValido('20-12345678-6')).toBe(true);
    expect(cuitValido('20123456787')).toBe(false);
    expect(cuitValido('2012345')).toBe(false);
  });
});

describe('Compras a proveedores', () => {
  let proveedor;
  it('compra a un proveedor del padrón: entra al stock y abre lote', async () => {
    proveedor = (await request(app).post('/api/clientes').set(as(NV)).send({ tipo: 'proveedor', razonSocial: 'Acopio del Sur', rubro: 'Acopiador', cuit: '20-12345678-6' }).expect(201)).body;
    await request(app).post('/api/compras').set(as(NV)).send({ items: [{ material: sinCompras._id, pesoKg: 10, precioKg: 1 }] }).expect(400);
    const c = await request(app).post('/api/compras').set(as(NV)).send({ proveedor: proveedor._id, items: [{ material: sinCompras._id, pesoKg: 500, precioKg: 100 }], pagada: true }).expect(201);
    expect(c.body).toMatchObject({ total: 50000, proveedor: { razonSocial: 'Acopio del Sur' } });
    const lotes = (await request(app).get('/api/lotes').set(as(NV))).body.items;
    expect(lotes.find((l) => l.material._id === sinCompras._id && l.origen.cliente?.razonSocial === 'Acopio del Sur')).toBeTruthy();
    // el resumen de recuperadores no mezcla compras a proveedores
    const resumen = (await request(app).get(`/api/recuperadores/resumen?mes=${mes}`).set(as(NV))).body;
    expect(JSON.stringify(resumen)).not.toContain('Acopio del Sur');
  });

  it('stock y margen por material', async () => {
    await request(app).post('/api/ventas').set(as(NV)).send({ comprador: comprador._id, items: [{ material: sinCompras._id, pesoKg: 200, precioKg: 150 }] }).expect(201);
    const r = (await request(app).get('/api/comercial/stock').set(as(NV)).expect(200)).body;
    const f = r.items.find((x) => x.materialId === sinCompras._id);
    expect(f.costoCompraProm).toBe(100);
    expect(f.compradoKg).toBe(500);
    expect(f.margenMes).not.toBeNull();
    expect(r.resumen.stockKg).toBeGreaterThan(0);
  });

  it('el padrón muestra lo comprado, lo vendido y el CUIT', async () => {
    const p = (await request(app).get('/api/comercial/padron').set(as(NV)).expect(200)).body.items;
    expect(p.find((x) => x.razonSocial === 'Acopio del Sur')).toMatchObject({ tipo: 'proveedor', cuitEstado: 'valido', comprado: { kg: 500, monto: 50000 } });
    expect(p.find((x) => x._id === comprador._id).vendido.kg).toBeGreaterThan(0);
    // un proveedor no puede tener acceso al portal de generadores
    await request(app).post(`/api/clientes/${proveedor._id}/acceso-portal`).set(as(NV)).send({ email: 'x@acopio.example', nombre: 'Xavier' }).expect(422);
  });
});

describe('Contratos de venta', () => {
  it('calcula el avance con las ventas y avisa si no se llega', async () => {
    const material = mats.find((m) => m._id !== sinCompras._id);
    await request(app).post('/api/contratos').set(as(NV)).send({ comprador: comprador._id, material: material._id, kg: 1000, precioKg: 150, desde: dia(0), hasta: dia(-1) }).expect(400);
    await request(app).post('/api/contratos').set(as(NV)).send({ comprador: comprador._id, material: material._id, kg: 1000, precioKg: 150, desde: dia(-10), hasta: dia(20) }).expect(201);
    await request(app).post('/api/ventas').set(as(NV)).send({ comprador: comprador._id, fecha: dia(-1), items: [{ material: material._id, pesoKg: 300, precioKg: 140 }] }).expect(201);
    const c = (await request(app).get('/api/contratos').set(as(NV)).expect(200)).body.items[0];
    expect(c.avance.entregado).toBeGreaterThanOrEqual(300);
    expect(c.avance.ventasBajoPrecio).toBeGreaterThanOrEqual(1);
    expect(['atrasado', 'en_curso']).toContain(c.avance.estado);
    expect((await request(app).get('/api/contratos').set(as(LITORAL))).body.items).toHaveLength(0);
  });
});

describe('Convenio con el municipio', () => {
  let cv;
  it('registra obligaciones y su cumplimiento mensual', async () => {
    cv = (await request(app).post('/api/convenios').set(as(NV)).send({ nombre: 'Convenio 12/2025', contraparte: 'Municipalidad de Paraná', desde: dia(-300) }).expect(201)).body;
    const pago = (await request(app).post(`/api/convenios/${cv._id}/obligaciones`).set(as(NV)).send({ parte: 'Municipio', que: 'Pago mensual por la operación de la planta', tipo: 'pago', meta: 1000000 }).expect(201)).body;
    const camion = (await request(app).post(`/api/convenios/${cv._id}/obligaciones`).set(as(NV)).send({ parte: 'Municipio', que: 'Entregar residuos de la recolección', tipo: 'cantidad', meta: 1, auto: true }).expect(201)).body;
    const serv = (await request(app).post(`/api/convenios/${cv._id}/obligaciones`).set(as(NV)).send({ parte: 'Organización', que: 'Informe mensual de toneladas', tipo: 'servicio' }).expect(201)).body;
    await request(app).post(`/api/convenios/${cv._id}/obligaciones`).set(as(NV)).send({ parte: 'Municipio', que: 'Sin meta', tipo: 'pago' }).expect(400);

    await request(app).put(`/api/convenios/${cv._id}/meses/${mes}/${pago.id}`).set(as(NV)).send({ v: 600000, nota: 'Pagó tarde' }).expect(200);
    await request(app).put(`/api/convenios/${cv._id}/meses/${mes}/${serv.id}`).set(as(NV)).send({ v: 1 }).expect(200);
    await request(app).put(`/api/convenios/${cv._id}/meses/${mes}/${serv.id}`).set(as(NV)).send({ v: 3 }).expect(422);
    await request(app).put(`/api/convenios/${cv._id}/meses/${mes}/${camion.id}`).set(as(NV)).send({ v: 5 }).expect(422);

    const r = (await request(app).get(`/api/convenios?mes=${mes}`).set(as(NV)).expect(200)).body.items[0];
    const e = Object.fromEntries(r.obligaciones.map((o) => [o.que, o]));
    expect(e['Pago mensual por la operación de la planta']).toMatchObject({ valor: 600000, estado: 'parcial', nota: 'Pagó tarde' });
    expect(e['Informe mensual de toneladas'].estado).toBe('cumple');
    expect(e['Entregar residuos de la recolección'].valor).toBeGreaterThan(0); // del libro de la planta
    expect(e['Pago mensual por la operación de la planta'].historial).toHaveLength(6);

    const res = (await request(app).get(`/api/convenios/${cv._id}/resumen?mes=${mes}`).set(as(NV)).expect(200)).body;
    expect(res.texto).toContain('Pactado 1000000, cumplido 600000 (Pagó tarde)');
  });
});

describe('Ingresos de caja', () => {
  it('suman al balance', async () => {
    const antes = (await request(app).get('/api/balance').set(as(NV))).body.ingresos.total;
    await request(app).post('/api/ingresos-caja').set(as(NV)).send({ concepto: 'Inventado', monto: 1 }).expect(400);
    await request(app).post('/api/ingresos-caja').set(as(NV)).send({ concepto: 'Pago del municipio', detalle: 'Cuota de noviembre', monto: 500000 }).expect(201);
    const b = (await request(app).get('/api/balance').set(as(NV))).body;
    expect(b.ingresos.otros).toBe(500000);
    expect(b.ingresos.total).toBe(antes + 500000);
    expect(b.movimientos.some((m) => m.concepto === 'Pago del municipio')).toBe(true);
  });
});
