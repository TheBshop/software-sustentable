import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setupSeed, NV, SUPERADMIN } from './helpers.js';

const app = createApp();
let ctx;
beforeAll(async () => {
  ctx = await setupSeed(app);
});
afterAll(() => ctx.teardown());

const as = (email) => ctx.as(email);

describe('Administración de la plataforma', () => {
  it('solo el superadmin entra; los admins de las organizaciones no', async () => {
    await request(app).get('/api/admin/organizaciones').set(as(NV)).expect(403);
    const res = await request(app).get('/api/admin/organizaciones').set(as(SUPERADMIN)).expect(200);
    expect(res.body.items.find((o) => o.nombre === 'Cooperativa Nueva Vida')).toMatchObject({ tipo: 'cooperativa', rol: 'operador', usuarios: 2 });
    expect(res.body.items.some((o) => o.tipo === 'plataforma')).toBe(false);
    const generadores = await request(app).get('/api/admin/organizaciones?rol=generador').set(as(SUPERADMIN)).expect(200);
    expect(generadores.body.items.every((o) => o.rol === 'generador')).toBe(true);
    // el superadmin no opera: no entra a la gestión de una organización
    await request(app).get('/api/clientes').set(as(SUPERADMIN)).expect(403);
  });

  it('da de alta una recicladora con su admin, que entra y opera', async () => {
    const alta = await request(app)
      .post('/api/admin/organizaciones')
      .set(as(SUPERADMIN))
      .send({ tipo: 'recicladora', nombre: 'Plásticos del Sur SA', cuit: '30-71000013-6', provincia: 'buenos_aires', admin: { email: 'admin@plasticosdelsur.example', nombre: 'Ana' } })
      .expect(201);
    expect(alta.body.organizacion).toMatchObject({ tipo: 'recicladora', rol: 'operador' });
    expect(alta.body.admin.password).toHaveLength(12);
    const login = await request(app).post('/api/auth/login').send({ email: 'admin@plasticosdelsur.example', password: alta.body.admin.password }).expect(200);
    await request(app).get('/api/clientes').set({ Authorization: `Bearer ${login.body.token}` }).expect(200);
  });

  it('valida duplicados, provincia y roles', async () => {
    const base = { tipo: 'cooperativa', nombre: 'Coop Duplicada', admin: { email: 'admin@nuevavida.local', nombre: 'Xavier' } };
    await request(app).post('/api/admin/organizaciones').set(as(SUPERADMIN)).send(base).expect(409);
    await request(app).post('/api/admin/organizaciones').set(as(SUPERADMIN)).send({ ...base, admin: { email: 'otra@coop.example', nombre: 'Xavier' }, provincia: 'atlantida' }).expect(422);
    const orgs = (await request(app).get('/api/admin/organizaciones').set(as(SUPERADMIN))).body.items;
    const nv = orgs.find((o) => o.nombre === 'Cooperativa Nueva Vida');
    await request(app).post(`/api/admin/organizaciones/${nv.id}/usuarios`).set(as(SUPERADMIN)).send({ email: 'x@nv.example', nombre: 'Xavier', rol: 'cliente' }).expect(422);
    const nuevo = await request(app).post(`/api/admin/organizaciones/${nv.id}/usuarios`).set(as(SUPERADMIN)).send({ email: 'planta@nv.example', nombre: 'Planta', rol: 'operador_planta' }).expect(201);
    const reset = await request(app).post(`/api/admin/usuarios/${nuevo.body.id}/password`).set(as(SUPERADMIN)).expect(200);
    expect(reset.body.password).not.toBe(nuevo.body.password);
  });

  it('dar de baja una organización bloquea el ingreso de sus usuarios', async () => {
    const orgs = (await request(app).get('/api/admin/organizaciones').set(as(SUPERADMIN))).body.items;
    const lit = orgs.find((o) => o.nombre === 'Cooperativa Reciclar del Litoral');
    await request(app).patch(`/api/admin/organizaciones/${lit.id}`).set(as(SUPERADMIN)).send({ activo: false }).expect(200);
    await request(app).post('/api/auth/login').send({ email: 'admin@litoral.local', password: 'admin1234' }).expect(403);
    await request(app).patch(`/api/admin/organizaciones/${lit.id}`).set(as(SUPERADMIN)).send({ activo: true }).expect(200);
  });
});
