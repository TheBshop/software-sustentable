import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setupSeed, NV, LITORAL } from './helpers.js';

const app = createApp();
let ctx;
let carton;
let comprador;
beforeAll(async () => {
  ctx = await setupSeed(app);
  const mats = (await request(app).get('/api/materiales?limit=200').set(ctx.as(NV))).body.items;
  carton = mats.find((m) => m.nombre.startsWith('Cartón') && !m.mezcla);
  comprador = (await request(app).get('/api/clientes?tipo=comprador').set(ctx.as(NV))).body.items[0];
});
afterAll(() => ctx.teardown());

const as = (email) => ctx.as(email);

describe('Manifiestos', () => {
  let manifiesto;
  it('emite un manifiesto manual con QR público', async () => {
    const r = await request(app).post('/api/manifiestos').set(as(NV)).send({
      destino: { razonSocial: 'Acopiadora Litoral', cuit: '30711111111', direccion: 'Ruta 11 km 500' },
      transporte: { razonSocial: 'Transportes del Sur', patente: 'AB123CD', chofer: 'Pedro' },
      items: [{ material: carton._id, kg: 500, unidades: 2 }],
      corriente: 'rsu',
    }).expect(201);
    expect(r.body).toMatchObject({ numero: 1, estado: 'emitido' });
    expect(r.body.codigoManifiesto).toBe('M-000001');
    expect(r.body.codigo).toMatch(/^[A-F0-9]{16}$/);
    manifiesto = r.body;
  });

  it('PDF del manifiesto', async () => {
    const pdf = await request(app).get(`/api/manifiestos/${manifiesto._id}/pdf`).set(as(NV))
      .buffer(true).parse((res, cb) => { const b = []; res.on('data', (c) => b.push(c)); res.on('end', () => cb(null, Buffer.concat(b))); })
      .expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.body.slice(0, 5).toString()).toBe('%PDF-');
  });

  it('página pública devuelve los datos sin autenticación', async () => {
    const r = await request(app).get(`/api/public/manifiestos/${manifiesto.codigo}`).expect(200);
    expect(r.body).toMatchObject({ numero: 'M-000001', estado: 'emitido' });
    expect(r.body.emisor.nombre).toBeTruthy();
    expect(r.body.items[0].material.nombre).toBeTruthy();
  });

  it('en_transito y luego recepción pública con firma', async () => {
    await request(app).patch(`/api/manifiestos/${manifiesto._id}/en-transito`).set(as(NV)).expect(200);
    const firma = 'data:image/png;base64,' + 'A'.repeat(100);
    const r = await request(app).post(`/api/public/manifiestos/${manifiesto.codigo}/recepcion`).send({
      firmaBase64: firma,
      firmanteNombre: 'Juan Pérez',
      firmanteDni: '30111222',
      lat: -31.73,
      lng: -60.52,
      observaciones: 'Entregado conforme',
    }).expect(200);
    expect(r.body).toMatchObject({ ok: true, numero: 'M-000001' });
    // Segunda recepción: 409
    await request(app).post(`/api/public/manifiestos/${manifiesto.codigo}/recepcion`).send({ firmaBase64: firma, firmanteNombre: 'Otro' }).expect(409);
    // Los datos públicos ya muestran recibido
    const pub = await request(app).get(`/api/public/manifiestos/${manifiesto.codigo}`).expect(200);
    expect(pub.body.estado).toBe('recibido');
    expect(pub.body.recepcion.firmanteNombre).toBe('Juan Pérez');
  });

  it('anulación con motivo, impide recepción', async () => {
    const r = await request(app).post('/api/manifiestos').set(as(NV)).send({
      destino: { razonSocial: 'X' },
      items: [{ material: carton._id, kg: 100 }],
    }).expect(201);
    await request(app).post(`/api/manifiestos/${r.body._id}/anular`).set(as(NV)).send({ motivo: 'Error en destinatario' }).expect(200);
    await request(app).post(`/api/public/manifiestos/${r.body.codigo}/recepcion`).send({ firmaBase64: 'data:x'.repeat(30), firmanteNombre: 'Test' }).expect(422);
    await request(app).post(`/api/manifiestos/${r.body._id}/anular`).set(as(NV)).send({ motivo: 'De nuevo' }).expect(409);
  });

  it('aislamiento entre organizaciones: Litoral no ve los manifiestos de Nueva Vida', async () => {
    const litoral = await request(app).get('/api/manifiestos').set(as(LITORAL)).expect(200);
    expect(litoral.body.items.every((m) => m.numero >= 1 && m.destino?.razonSocial !== 'Acopiadora Litoral')).toBe(true);
  });

  it('desde remito: copia items, destinatario y transporte', async () => {
    // crear un remito emitiendo una venta de lote
    await request(app).post('/api/ingresos').set(as(NV)).send({ origen: 'recuperador', items: [{ material: carton._id, pesoKg: 200 }] }).expect(201);
    const lotes = (await request(app).get('/api/lotes').set(as(NV))).body.items;
    const lote = lotes.find((l) => l.material._id === carton._id && l.etapa === 'recepcion');
    await request(app).post(`/api/lotes/${lote._id}/clasificar`).set(as(NV)).send({ kgSeparado: 180 }).expect(200);
    await request(app).post(`/api/lotes/${lote._id}/enfardar`).set(as(NV)).send({ unidades: 1, kgFinal: 180 }).expect(200);
    const venta = await request(app).post('/api/lotes/vender').set(as(NV)).send({
      comprador: comprador._id,
      items: [{ lote: lote._id, kg: 180, precioKg: 100 }],
      transporte: { patente: 'XY111ZZ' },
    }).expect(201);
    const m = await request(app).post(`/api/manifiestos/desde-remito/${venta.body.remito.id}`).set(as(NV)).expect(201);
    expect(m.body.items[0].kg).toBe(180);
    expect(m.body.transporte.patente).toBe('XY111ZZ');
  });
});
