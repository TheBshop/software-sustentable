import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { Organization } from '../src/modules/organizations/organization.model.js';
import { setupSeed, NV, EMPRESA, MUNICIPIO, RECICLADORA, MUNI_OPERADOR } from './helpers.js';

const app = createApp();
let ctx;
beforeAll(async () => {
  ctx = await setupSeed(app);
});
afterAll(() => ctx.teardown());

const get = (email, path) => request(app).get(`/api${path}`).set(ctx.as(email));
const post = (email, path, body) => request(app).post(`/api${path}`).set(ctx.as(email)).send(body);

describe('Organizaciones operadoras y generadoras', () => {
  it('cooperativas y recicladoras son operadoras por defecto; empresas y municipios sin rol, generadores', async () => {
    const porTipo = async (tipo, extra = {}) => (await Organization.create({ tipo, nombre: `Org ${tipo}`, ...extra })).rol;
    expect(await porTipo('cooperativa')).toBe('operador');
    expect(await porTipo('recicladora')).toBe('operador');
    expect(await porTipo('empresa')).toBe('generador');
    expect(await porTipo('municipio')).toBe('generador');
    expect(await porTipo('municipio', { rol: 'operador' })).toBe('operador');
  });

  it('la sesión informa el rol de la organización', async () => {
    const login = async (email, password) => (await request(app).post('/api/auth/login').send({ email, password })).body.user.organizacion;
    expect(await login(RECICLADORA, 'admin1234')).toMatchObject({ tipo: 'recicladora', rol: 'operador' });
    expect(await login(MUNI_OPERADOR, 'admin1234')).toMatchObject({ tipo: 'municipio', rol: 'operador' });
    expect(await login(MUNICIPIO, 'municipio1234')).toMatchObject({ tipo: 'municipio', rol: 'generador' });
  });

  it('una recicladora y un municipio operador usan la zona de gestión con sus datos aislados', async () => {
    expect((await get(RECICLADORA, '/clientes')).body.total).toBe(0);
    expect((await get(MUNI_OPERADOR, '/clientes')).body.total).toBe(0);
    const alta = await post(RECICLADORA, '/clientes', { razonSocial: 'Industria Cliente de la Recicladora', tipo: 'generador' }).expect(201);
    expect((await get(RECICLADORA, '/clientes')).body.total).toBe(1);
    expect((await get(MUNI_OPERADOR, '/clientes')).body.total).toBe(0);
    expect((await get(NV, '/clientes')).body.items.some((c) => c.razonSocial.startsWith('Industria Cliente'))).toBe(false);
    await get(NV, `/clientes/${alta.body._id}`).expect(404);
  });

  it('los generadores no entran a la gestión y los operadores no entran al portal', async () => {
    await get(EMPRESA, '/clientes').expect(403);
    await get(MUNICIPIO, '/clientes').expect(403);
    await get(RECICLADORA, '/v1/portal/resumen').expect(403);
    await get(MUNI_OPERADOR, '/v1/portal/resumen').expect(403);
    await get(EMPRESA, '/v1/portal/resumen').expect(200);
  });
});
