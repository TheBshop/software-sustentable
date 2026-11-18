// Ordenanza 9233 de Paraná (residuos de gestión diferenciada, registro de acopios, seguridad
// del personal, inclusión de recuperadores) y herramientas tomadas del análisis de Manglai
// (documentos del traslado, factores de CO2 con fuente, recomendaciones al generador).
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setupSeed, NV, EMPRESA, MUNICIPIO } from './helpers.js';

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const app = createApp();
let ctx;
let mat;
let cli;
beforeAll(async () => {
  ctx = await setupSeed(app);
  mat = Object.fromEntries((await api(NV).get('/materiales?limit=200')).body.items.map((m) => [m.codigo, m]));
  cli = Object.fromEntries((await api(NV).get('/clientes')).body.items.map((c) => [c.razonSocial.split(' ')[0], c]));
});
afterAll(() => ctx.teardown());

function api(email) {
  return {
    get: (p) => request(app).get(`/api${p}`).set(ctx.as(email)),
    post: (p, b) => request(app).post(`/api${p}`).set(ctx.as(email)).send(b),
    put: (p, b) => request(app).put(`/api${p}`).set(ctx.as(email)).send(b),
    delete: (p) => request(app).delete(`/api${p}`).set(ctx.as(email)),
  };
}
const anio = new Date().getFullYear();

describe('Ordenanza 9233 de Paraná', () => {
  it('acepta los residuos de gestión diferenciada del art. 5 como REGU', async () => {
    for (const subtipoRegu of ['medicamentos', 'baterias_vehiculos', 'termometros', 'higiene_personal']) {
      await api(NV).post('/materiales', { codigo: subtipoRegu.slice(0, 8).toUpperCase(), nombre: subtipoRegu, categoria: 'otros', corriente: 'regu', subtipoRegu }).expect(201);
    }
  });

  it('el registro municipal de acopios se imprime en los certificados nuevos', async () => {
    await api(NV)
      .put('/planta/organizacion/registros', {
        registros: [
          { descripcion: 'Registro municipal de depósitos de acopio', organismo: 'Municipalidad de Paraná', numero: 'RA-123' },
          { descripcion: 'Inscripción vencida', numero: 'X-1', vence: '2020-01-01' },
        ],
      })
      .expect(200);
    await api(NV).put('/planta/organizacion/registros', { registros: [{ descripcion: 'x' }] }).expect(400);

    const r = (await api(NV).post('/retiros', { cliente: cli.Supermercado._id, items: [{ material: mat.CART._id, pesoEstimadoKg: 20 }] })).body;
    const cert = (await api(NV).post(`/retiros/${r._id}/certificado`).expect(201)).body;
    expect(cert.emisorSnapshot.registros).toEqual([{ descripcion: 'Registro municipal de depósitos de acopio', organismo: 'Municipalidad de Paraná', numero: 'RA-123' }]);
    await api(NV).get(`/certificados/${cert._id}/pdf`).buffer(true).expect(200);
  });

  it('registra EPP y capacitaciones y avisa a quién le falta renovar', async () => {
    await api(NV).post('/seguridad', { tipo: 'epp', persona: 'Ana Gómez', elementos: ['guantes', 'botines'] }).expect(201);
    await api(NV).post('/seguridad', { tipo: 'epp', persona: 'Ana Gómez' }).expect(400); // sin elementos
    await api(NV).post('/seguridad', { tipo: 'capacitacion', persona: 'Ana Gómez' }).expect(400); // sin tema
    const { body } = await api(NV).get('/seguridad/resumen').expect(200);
    const ana = body.items.find((p) => p.persona === 'Ana Gómez');
    expect(ana).toMatchObject({ eppVencido: false, capacitacionVencida: true });
    expect(body.items.find((p) => p.persona === 'Socio de ejemplo 3').eppVencido).toBe(true); // entrega de hace 250 días
    // la empresa no accede a datos internos de la cooperativa
    await request(app).get('/api/seguridad/resumen').set(ctx.as(EMPRESA)).expect(403);
  });

  it('el municipio ve lo que entró a planta por recuperadores y recolección municipal', async () => {
    const { body } = await request(app).get(`/api/v1/portal/resumen?anio=${anio}`).set(ctx.as(MUNICIPIO)).expect(200);
    expect(body.inclusion.recuperadoresKg).toBeGreaterThanOrEqual(89);
    expect(body.inclusion.recoleccionMunicipalKg).toBeGreaterThan(0);
    const empresa = (await request(app).get(`/api/v1/portal/resumen?anio=${anio}`).set(ctx.as(EMPRESA))).body;
    expect(empresa.inclusion).toBeNull(); // solo para municipios
  });
});

describe('Herramientas tomadas de Manglai', () => {
  it('adjunta documentos al retiro y el cliente los descarga desde su portal', async () => {
    const r = (await api(NV).post('/retiros', { cliente: cli.Supermercado._id, items: [{ material: mat.CART._id, pesoEstimadoKg: 30 }] })).body;
    const up = await request(app).post(`/api/retiros/${r._id}/documentos`).set(ctx.as(NV)).field('tipo', 'remito').field('numero', 'R-77').attach('archivo', PDF, { filename: 'remito.pdf', contentType: 'application/pdf' }).expect(201);
    const doc = up.body.documentos[0];
    expect(doc).toMatchObject({ tipo: 'remito', numero: 'R-77', nombre: 'remito.pdf' });
    await request(app).post(`/api/retiros/${r._id}/documentos`).set(ctx.as(NV)).field('tipo', 'remito').attach('archivo', Buffer.from('x'), { filename: 'a.txt', contentType: 'text/plain' }).expect(400);

    const bajada = await api(NV).get(`/retiros/${r._id}/documentos/${doc._id}`).buffer(true).expect(200);
    expect(bajada.headers['content-type']).toContain('application/pdf');

    const portal = (await request(app).get(`/api/v1/portal/retiros?anio=${anio}`).set(ctx.as(EMPRESA))).body.items.find((x) => x.id === r._id);
    expect(portal.documentos).toEqual([{ id: doc._id, tipo: 'remito', numero: 'R-77', nombre: 'remito.pdf' }]);
    await request(app).get(`/api/v1/portal/retiros/${r._id}/documentos/${doc._id}`).set(ctx.as(EMPRESA)).buffer(true).expect(200);
    // otro generador no lo puede bajar
    await request(app).get(`/api/v1/portal/retiros/${r._id}/documentos/${doc._id}`).set(ctx.as(MUNICIPIO)).expect(404);

    await api(NV).delete(`/retiros/${r._id}/documentos/${doc._id}`).expect(204);
  });

  it('el certificado y el informe llevan el factor de CO2 con su fuente', async () => {
    await request(app).patch(`/api/materiales/${mat.PET._id}`).set(ctx.as(NV)).send({ factorCo2Fuente: 'Fuente de prueba 2026' }).expect(200);
    const r = (await api(NV).post('/retiros', { cliente: cli.Supermercado._id, items: [{ material: mat.PET._id, pesoEstimadoKg: 10 }] })).body;
    const cert = (await api(NV).post(`/retiros/${r._id}/certificado`).expect(201)).body;
    expect(cert.materiales[0]).toMatchObject({ factorCo2: 1.5, factorCo2Fuente: 'Fuente de prueba 2026', co2EvitadoKg: 15 });
    const pub = (await request(app).get(`/api/public/certificados/${cert.codigo}`)).body;
    expect(pub.materiales[0].factorCo2Fuente).toBe('Fuente de prueba 2026');

    const resumen = (await request(app).get(`/api/v1/portal/resumen?anio=${anio}`).set(ctx.as(EMPRESA))).body;
    expect(resumen.porMaterial.find((m) => m.material === 'PET').factores).toContainEqual({ cooperativa: 'Cooperativa Nueva Vida', factorCo2: 1.5, fuente: 'Fuente de prueba 2026' });
    const pdf = await request(app).get(`/api/v1/portal/informe-anual.pdf?anio=${anio}`).set(ctx.as(EMPRESA)).buffer(true).expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
  });

  it('recomienda acciones al generador según sus propios rechazos', async () => {
    const { body } = await request(app).get(`/api/v1/portal/resumen?anio=${anio}`).set(ctx.as(EMPRESA)).expect(200);
    const titulos = body.recomendaciones.map((r) => r.titulo);
    expect(titulos).toContain('Guardá el papel y el cartón bajo techo'); // el seed tiene un rechazo por humedad
    expect(titulos).not.toContain('Separá secos y húmedos en recipientes distintos'); // no hubo rechazos por mezcla
    expect(body.recomendaciones.every((r) => ['alta', 'media', 'info'].includes(r.prioridad))).toBe(true);
  });
});
