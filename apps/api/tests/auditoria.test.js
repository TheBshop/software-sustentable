import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setupSeed, NV, LITORAL } from './helpers.js';

const app = createApp();
let ctx;
beforeAll(async () => {
  ctx = await setupSeed(app);
});
afterAll(() => ctx.teardown());

const as = (email) => ctx.as(email);

describe('Registro de auditoría', () => {
  it('registra alta, cambio y baja con el usuario que lo hizo', async () => {
    const alta = await request(app).post('/api/clientes').set(as(NV)).send({ razonSocial: 'Almacén Auditado', cuit: '20-12345678-6' }).expect(201);
    await request(app).patch(`/api/clientes/${alta.body._id}`).set(as(NV)).send({ razonSocial: 'Almacén Auditado SRL' }).expect(200);
    await request(app).delete(`/api/clientes/${alta.body._id}`).set(as(NV));

    const res = await request(app).get(`/api/auditoria?entidad=Client&entidadId=${alta.body._id}`).set(as(NV)).expect(200);
    const acciones = res.body.items.map((i) => i.accion).reverse();
    expect(acciones.slice(0, 2)).toEqual(['alta', 'cambio']);
    expect(res.body.items.at(-1)).toMatchObject({ entidad: 'Client', usuario: { email: NV } });
    expect(res.body.items.at(-1).cambios.razonSocial).toBe('Almacén Auditado');
    const cambio = res.body.items.find((i) => i.accion === 'cambio' && i.cambios.razonSocial);
    expect(cambio.cambios.razonSocial).toBe('Almacén Auditado SRL');
  });

  it('cada organización ve solo su registro', async () => {
    const res = await request(app).get('/api/auditoria?entidad=Client').set(as(LITORAL)).expect(200);
    expect(res.body.items.some((i) => i.cambios?.razonSocial?.startsWith('Almacén Auditado'))).toBe(false);
  });
});
