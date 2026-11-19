import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setupSeed, NV, LITORAL } from './helpers.js';

const app = createApp();
let ctx;
beforeAll(async () => { ctx = await setupSeed(app); });
afterAll(() => ctx.teardown());
const as = (email) => ctx.as(email);

async function clienteDe(email) {
  const r = await request(app).get('/api/clientes?limit=5').set(as(email));
  return r.body.items[0];
}

describe('Presupuestos', () => {
  let presupuestoId;
  let numeroP;

  it('crea un presupuesto con líneas y calcula subtotales', async () => {
    const cli = await clienteDe(NV);
    const r = await request(app).post('/api/presupuestos').set(as(NV)).send({
      cliente: cli._id,
      vigenciaHasta: '2027-01-31',
      notas: 'Vigencia 30 días; condiciones de pago a convenir.',
      lineas: [
        { descripcion: 'Retiro mensual', cantidad: 4, unidad: 'retiro', precioUnitario: 15000 },
        { descripcion: 'Capacitación inicial', cantidad: 1, unidad: 'servicio', precioUnitario: 50000 },
      ],
    }).expect(201);
    expect(r.body.total).toBe(110000);
    expect(r.body.lineas[0].subtotal).toBe(60000);
    expect(r.body.estado).toBe('vigente');
    expect(r.body.numero).toBeGreaterThan(0);
    presupuestoId = r.body._id;
    numeroP = r.body.numero;
  });

  it('devuelve el PDF del presupuesto', async () => {
    const r = await request(app).get(`/api/presupuestos/${presupuestoId}/pdf`).set(as(NV)).expect(200);
    expect(r.headers['content-type']).toMatch(/pdf/);
    expect(r.body.length).toBeGreaterThan(500);
  });

  it('no deja a otra cooperativa ver el presupuesto', async () => {
    await request(app).get(`/api/presupuestos/${presupuestoId}`).set(as(LITORAL)).expect(404);
  });

  it('cambia estado a aceptado y lo convierte en factura', async () => {
    await request(app).post(`/api/presupuestos/${presupuestoId}/estado`).set(as(NV)).send({ estado: 'aceptado' }).expect(200);
    const r = await request(app).post(`/api/presupuestos/${presupuestoId}/convertir`).set(as(NV)).send({ vencimiento: '2027-02-15' }).expect(200);
    expect(r.body.factura.total).toBe(110000);
    expect(r.body.factura.estado).toBe('pendiente');
    expect(r.body.presupuesto.estado).toBe('convertido');
    expect(r.body.presupuesto.facturaGenerada).toBe(r.body.factura._id);
  });

  it('no permite convertir dos veces', async () => {
    await request(app).post(`/api/presupuestos/${presupuestoId}/convertir`).set(as(NV)).send({}).expect(409);
  });

  it('un rol no administrativo no puede crear', async () => {
    const cli = await clienteDe(NV);
    await request(app).post('/api/presupuestos').set(ctx.as('chofer@nuevavida.local')).send({
      cliente: cli._id, vigenciaHasta: '2027-01-31', lineas: [{ descripcion: 'x', precioUnitario: 1 }],
    }).expect(403);
  });

  it('numeración correlativa por cooperativa', async () => {
    const cli = await clienteDe(NV);
    const r = await request(app).post('/api/presupuestos').set(as(NV)).send({
      cliente: cli._id, vigenciaHasta: '2027-01-31', lineas: [{ descripcion: 'x', precioUnitario: 100 }],
    }).expect(201);
    expect(r.body.numero).toBe(numeroP + 1);
  });
});
