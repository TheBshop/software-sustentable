import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import ExcelJS from 'exceljs';
import { createApp } from '../src/app.js';
import { requireAuth, requireOperador } from '../src/middleware/auth.js';
import { errorHandler } from '../src/middleware/error.js';
import { withTenant, runWithTenant } from '../src/lib/tenancy.js';
import { contabilidadRouter } from '../src/modules/contabilidad/contabilidad.routes.js';
import { Invoice } from '../src/modules/invoices/invoice.model.js';
import { setupSeed, NV, LITORAL, EMPRESA } from './helpers.js';

// El router todavía no está montado en app.js: lo montamos con la misma cadena de middlewares
// que usa la zona de gestión (auth → tenant → operador).
const app = createApp();
const conta = express();
conta.use(express.json());
conta.use('/api', requireAuth, withTenant);
conta.use('/api', requireOperador());
conta.use('/api/contabilidad', contabilidadRouter);
conta.use(errorHandler);

let ctx;
let cliCF;
let cliRI;
// Período de prueba lejano: no se cruza con los datos de ejemplo del seed
const P = 'desde=2020-03-01&hasta=2020-03-31';
const as = (email) => ctx.as(email);
const get = (path, email = NV) => request(conta).get(`/api/contabilidad${path}`).set(as(email));
const binario = (res, cb) => {
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};

beforeAll(async () => {
  ctx = await setupSeed(app);
  const mat = (await request(app).get('/api/materiales?limit=200').set(as(NV))).body.items.find((m) => !m.mezcla && m.corriente === 'rsu');
  cliCF = (await request(app).post('/api/clientes').set(as(NV)).send({ tipo: 'comprador', razonSocial: 'Consumidor del barrio' }).expect(201)).body;
  cliRI = (await request(app).post('/api/clientes').set(as(NV)).send({ tipo: 'ambos', razonSocial: 'Acopio SRL', cuit: '20-12345678-6', condicionIva: 'responsable_inscripto' }).expect(201)).body;

  // Compra a proveedor RI (pagada): 500 kg x 121 = 60.500
  await request(app).post('/api/compras').set(as(NV)).send({ fecha: '2020-03-05', proveedor: cliRI._id, items: [{ material: mat._id, pesoKg: 500, precioKg: 121 }], pagada: true }).expect(201);
  // Ventas: a consumidor final 12.100 y a RI 5.000
  await request(app).post('/api/ventas').set(as(NV)).send({ fecha: '2020-03-10', comprador: cliCF._id, remito: 'R-1', items: [{ material: mat._id, pesoKg: 100, precioKg: 121 }] }).expect(201);
  await request(app).post('/api/ventas').set(as(NV)).send({ fecha: '2020-03-11', comprador: cliRI._id, items: [{ material: mat._id, pesoKg: 50, precioKg: 100 }] }).expect(201);
  // Gastos y caja
  const gasto = (fecha, categoria, monto, extra = {}) => request(app).post('/api/gastos').set(as(NV)).send({ fecha, categoria, descripcion: `Gasto ${categoria}`, monto, ...extra }).expect(201);
  await gasto('2020-03-12', 'servicios', 2000, { proveedor: 'Cooperativa eléctrica', comprobante: 'A-0001' });
  await gasto('2020-03-13', 'impuestos', 500);
  await gasto('2020-03-14', 'retiros_socios', 300);
  await request(app).post('/api/ingresos-caja').set(as(NV)).send({ fecha: '2020-03-02', concepto: 'Pago del municipio', monto: 10000 }).expect(201);
  // Liquidaciones: una exenta con un cobro parcial y una anulada (no debe aparecer)
  await runWithTenant(ctx.orgs.nv._id, async () => {
    const base = { cliente: cliRI._id, vencimiento: new Date('2020-04-15'), lineas: [] };
    await Invoice.create({ ...base, numero: 9001, total: 3000, emitidaEn: new Date('2020-03-15T15:00:00Z'), clienteSnapshot: { razonSocial: 'Fundación Exenta', cuit: '30111111118', condicionIva: 'exento' }, pagos: [{ fecha: new Date('2020-03-20T15:00:00Z'), monto: 1000, medio: 'transferencia' }] });
    await Invoice.create({ ...base, numero: 9002, total: 777, estado: 'anulada', emitidaEn: new Date('2020-03-16T15:00:00Z'), clienteSnapshot: { razonSocial: 'Anulada SA', cuit: '30222222223', condicionIva: 'responsable_inscripto' } });
  });
  // Otra organización con sus propios movimientos en el mismo período
  await request(app).post('/api/gastos').set(as(LITORAL)).send({ fecha: '2020-03-12', categoria: 'otros', descripcion: 'Gasto ajeno', monto: 99999 }).expect(201);
});
afterAll(() => ctx.teardown());

describe('Libro IVA ventas', () => {
  it('lista ventas y liquidaciones con el IVA discriminado', async () => {
    const r = (await get(`/libro-iva-ventas?${P}`).expect(200)).body;
    expect(r.filas).toHaveLength(3); // la anulada no cuenta
    expect(r.filas.map((f) => f.fecha)).toEqual([...r.filas.map((f) => f.fecha)].sort());
    expect(r.filas[0]).toMatchObject({ comprobante: 'Remito R-1', cliente: 'Consumidor del barrio', cuit: '', condicionIva: 'Consumidor Final', neto: 10000, iva21: 2100, iva105: 0, exento: 0, percepciones: 0, total: 12100 });
    expect(r.filas[1]).toMatchObject({ cliente: 'Acopio SRL', cuit: '20-12345678-6', condicionIva: 'Responsable Inscripto', neto: 4132.23, iva21: 867.77, total: 5000 });
    expect(r.filas[2]).toMatchObject({ comprobante: 'Liquidación 9001', cliente: 'Fundación Exenta', condicionIva: 'Exento', neto: 0, iva21: 0, exento: 3000, total: 3000 });
    expect(r.totales).toEqual({ neto: 14132.23, iva21: 2967.77, iva105: 0, exento: 3000, percepciones: 0, total: 20100 });
    expect(r.totales.neto + r.totales.iva21 + r.totales.exento).toBeCloseTo(r.totales.total, 2);
  });

  it('respeta el período y valida las fechas', async () => {
    const r = (await get('/libro-iva-ventas?desde=2020-03-11&hasta=2020-03-11').expect(200)).body;
    expect(r.filas.map((f) => f.cliente)).toEqual(['Acopio SRL']);
    await get('/libro-iva-ventas?desde=2020-04-01&hasta=2020-03-01').expect(400);
    await get('/libro-iva-ventas?desde=ayer').expect(400);
  });
});

describe('Libro IVA compras', () => {
  it('suma compras y gastos (sin retiros de socios)', async () => {
    const r = (await get(`/libro-iva-compras?${P}`).expect(200)).body;
    expect(r.filas).toHaveLength(3);
    expect(r.filas[0]).toMatchObject({ origen: 'compra', proveedor: 'Acopio SRL', cuit: '20-12345678-6', condicionIva: 'Responsable Inscripto', neto: 50000, iva21: 10500, otrosImpuestos: 0, total: 60500 });
    expect(r.filas[1]).toMatchObject({ origen: 'gasto', proveedor: 'Cooperativa eléctrica', comprobante: 'A-0001', neto: 2000, iva21: 0, total: 2000 });
    expect(r.filas[2]).toMatchObject({ neto: 0, otrosImpuestos: 500, total: 500 });
    expect(r.totales).toEqual({ neto: 52000, iva21: 10500, otrosImpuestos: 500, total: 63000 });
  });
});

describe('Mayor', () => {
  it('caja: ingresos y cobros al haber, gastos y compras pagadas al debe', async () => {
    const r = (await get(`/mayor?cuenta=caja&${P}`).expect(200)).body;
    expect(r.totales).toEqual({ debe: 63300, haber: 11000, saldo: -52300 });
    expect(r.filas).toHaveLength(6);
    expect(r.filas.at(-1).saldo).toBe(-52300);
    expect(r.filas[0]).toMatchObject({ haber: 10000, saldo: 10000 }); // 2/3 ingreso del municipio
  });

  it('ventas: ventas y liquidaciones al haber', async () => {
    const r = (await get(`/mayor?cuenta=ventas&${P}`).expect(200)).body;
    expect(r.totales).toEqual({ debe: 0, haber: 20100, saldo: 20100 });
    expect(r.filas).toHaveLength(3);
  });

  it('gastos: gastos y compras al debe', async () => {
    const r = (await get(`/mayor?cuenta=gastos&${P}`).expect(200)).body;
    expect(r.totales).toEqual({ debe: 63300, haber: 0, saldo: 63300 });
  });

  it('clientes: liquidación emitida al debe, cobro al haber, con saldo inicial', async () => {
    const r = (await get(`/mayor?cuenta=clientes&${P}`).expect(200)).body;
    expect(r.filas.map((f) => [f.debe, f.haber, f.saldo])).toEqual([[3000, 0, 3000], [0, 1000, 2000]]);
    const parcial = (await get('/mayor?cuenta=clientes&desde=2020-03-18&hasta=2020-03-31').expect(200)).body;
    expect(parcial.saldoInicial).toBe(3000);
    expect(parcial.filas).toHaveLength(1);
    expect(parcial.totales.saldo).toBe(2000);
  });

  it('exige una cuenta válida', async () => {
    await get(`/mayor?${P}`).expect(400);
    await get(`/mayor?cuenta=capital&${P}`).expect(400);
  });
});

describe('Exportación .xlsx', () => {
  const descargar = (path, email = NV) => request(conta).get(`/api/contabilidad${path}`).set(as(email)).buffer(true).parse(binario);

  for (const [ruta, hoja, cabecera] of [
    ['/libro-iva-ventas.xlsx?' + P, 'Libro IVA Ventas', 'Fecha'],
    ['/libro-iva-compras.xlsx?' + P, 'Libro IVA Compras', 'Fecha'],
    ['/mayor.xlsx?cuenta=caja&' + P, 'Mayor caja', 'Fecha'],
  ]) {
    it(`${ruta.split('?')[0]} es un Excel válido`, async () => {
      const res = await descargar(ruta).expect(200);
      expect(res.headers['content-type']).toContain('spreadsheet');
      expect(res.headers['content-disposition']).toContain('.xlsx');
      expect(res.body.subarray(0, 2).toString()).toBe('PK');
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(res.body);
      expect(wb.worksheets.map((w) => w.name)).toEqual([hoja]);
      const ws = wb.worksheets[0];
      expect(ws.getRow(2).getCell(1).value).toBe(cabecera);
      expect(ws.getRow(2).font.bold).toBe(true);
      const ultima = ws.getRow(ws.rowCount);
      expect(ultima.getCell(1).value).toBe('TOTALES');
      expect(ultima.font.bold).toBe(true);
    });
  }

  it('los totales del Excel coinciden con el JSON y llevan formato de moneda', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await descargar(`/libro-iva-ventas.xlsx?${P}`).expect(200)).body);
    const ws = wb.worksheets[0];
    const ultima = ws.getRow(ws.rowCount);
    expect(ultima.getCell(11).value).toBe(20100);
    expect(ultima.getCell(7).value).toBe(2967.77);
    expect(ws.getColumn(11).numFmt).toContain('$');
  });
});

describe('Seguridad y aislamiento', () => {
  it('cada organización ve solo lo suyo', async () => {
    for (const ruta of ['/libro-iva-ventas', '/libro-iva-compras']) {
      const r = (await get(`${ruta}?${P}`, LITORAL).expect(200)).body;
      expect(JSON.stringify(r)).not.toContain('Acopio SRL');
    }
    const compras = (await get(`/libro-iva-compras?${P}`, LITORAL).expect(200)).body;
    expect(compras.filas.map((f) => f.total)).toEqual([99999]);
    expect((await get(`/libro-iva-ventas?${P}`, LITORAL).expect(200)).body.totales.total).toBe(0);
    for (const cuenta of ['caja', 'ventas', 'clientes']) {
      expect((await get(`/mayor?cuenta=${cuenta}&${P}`, LITORAL).expect(200)).body.filas.filter((f) => f.concepto.includes('Acopio'))).toEqual([]);
    }
    expect((await get(`/mayor?cuenta=gastos&${P}`, LITORAL).expect(200)).body.totales.debe).toBe(99999);
    // y lo de la otra organización no contamina la propia
    expect((await get(`/libro-iva-compras?${P}`).expect(200)).body.totales.total).toBe(63000);
    const xlsxOtra = await request(conta).get(`/api/contabilidad/libro-iva-ventas.xlsx?${P}`).set(as(LITORAL)).buffer(true).parse(binario).expect(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(xlsxOtra.body);
    expect(JSON.stringify(wb.worksheets[0].getSheetValues())).not.toContain('Acopio');
  });

  it('exige sesión y zona de gestión', async () => {
    await request(conta).get(`/api/contabilidad/libro-iva-ventas?${P}`).expect(401);
    await get(`/libro-iva-ventas?${P}`, EMPRESA).expect(403);
  });
});
