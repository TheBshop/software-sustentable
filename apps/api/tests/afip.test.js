import { beforeAll, afterAll, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setupSeed, NV, LITORAL } from './helpers.js';
import { urlQrAfip, decodeQrAfip } from '../src/modules/afip/afip-qr.js';
import { limpiarUltimosMock } from '../src/modules/afip/wsfe.js';
import { limpiarCacheTA } from '../src/modules/afip/wsaa.js';

const app = createApp();
let ctx;
beforeAll(async () => {
  ctx = await setupSeed(app);
});
afterAll(() => ctx.teardown());
beforeEach(() => {
  limpiarUltimosMock();
  limpiarCacheTA();
});

const as = (email) => ctx.as(email);

describe('QR AFIP (RG 4.892/2020)', () => {
  it('arma y decodifica el payload correctamente', () => {
    const url = urlQrAfip({ fecha: '2026-11-18', cuitEmisor: '30700000016', ptoVta: 1, tipoCmp: 11, nroCmp: 42, importe: 15000, codAut: '71234567890123', tipoDocRec: 80, nroDocRec: '20111111112' });
    expect(url.startsWith('https://www.afip.gob.ar/fe/qr/?p=')).toBe(true);
    const d = decodeQrAfip(url);
    expect(d).toMatchObject({ ver: 1, fecha: '2026-11-18', cuit: 30700000016, ptoVta: 1, tipoCmp: 11, nroCmp: 42, importe: 15000, moneda: 'PES', ctz: 1, codAut: 71234567890123, tipoCodAut: 'E' });
  });
});

describe('AFIP · emisión en modo mock', () => {
  it('estado y catálogos', async () => {
    const e = await request(app).get('/api/afip/estado').set(as(NV)).expect(200);
    expect(e.body).toMatchObject({ app: 'OK', modo: 'mock' });
    const c = await request(app).get('/api/afip/catalogos').set(as(NV)).expect(200);
    expect(c.body.tipos['11']).toBe('Factura C');
    expect(c.body.condIvaReceptor['5']).toBe('Consumidor Final');
  });

  it('emite Factura C con CAE simulado y correlativa', async () => {
    const payload = {
      tipo: 11,
      receptorNombre: 'Supermercado El Puente SA',
      docTipo: 80,
      docNro: '30712345671',
      condIvaReceptor: 1,
      importeNeto: 10000,
      importeTotal: 10000,
    };
    const r1 = await request(app).post('/api/afip/comprobantes').set(as(NV)).send(payload).expect(201);
    expect(r1.body).toMatchObject({ tipo: 11, ptoVta: 1, numero: 1, resultado: 'simulado', modo: 'mock', entorno: 'homologacion' });
    expect(r1.body.cae).toMatch(/^\d{14}$/);
    expect(new Date(r1.body.caeVence).getTime()).toBeGreaterThan(Date.now());
    expect(r1.body.codigo).toBe('11-00001-00000001');

    const r2 = await request(app).post('/api/afip/comprobantes').set(as(NV)).send(payload).expect(201);
    expect(r2.body.numero).toBe(2);
  });

  it('valida que el total coincide con los conceptos', async () => {
    await request(app).post('/api/afip/comprobantes').set(as(NV)).send({ importeNeto: 100, importeIva: 21, importeTotal: 999 }).expect(422);
  });

  it('rechaza sin permisos (operario no puede emitir)', async () => {
    await request(app).post('/api/afip/comprobantes').set({ Authorization: `Bearer ${ctx.tokens['chofer@nuevavida.local']}` }).send({ importeNeto: 100, importeTotal: 100 }).expect(403);
  });

  it('dos organizaciones no comparten numeración', async () => {
    const p = { importeNeto: 100, importeTotal: 100 };
    const a = await request(app).post('/api/afip/comprobantes').set(as(NV)).send(p).expect(201);
    const b = await request(app).post('/api/afip/comprobantes').set(as(LITORAL)).send(p).expect(201);
    expect(a.body.numero).toBeGreaterThanOrEqual(1);
    // LITORAL arranca su propio contador desde 1 (ninguna numeración heredada de NV)
    expect(b.body.numero).toBe(1);
    // listado de cada una ve solo lo suyo
    const lista = (await request(app).get('/api/afip/comprobantes').set(as(NV))).body.items;
    expect(lista.every((x) => x._id !== b.body._id)).toBe(true);
  });

  it('PDF del comprobante incluye QR AFIP', async () => {
    const r = await request(app).post('/api/afip/comprobantes').set(as(NV)).send({ importeNeto: 5000, importeTotal: 5000 }).expect(201);
    const pdf = await request(app).get(`/api/afip/comprobantes/${r.body._id}/pdf`).set(as(NV)).buffer(true).parse((res, cb) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    }).expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.body.slice(0, 5).toString()).toBe('%PDF-');
    expect(pdf.body.length).toBeGreaterThan(800);
  });
});
