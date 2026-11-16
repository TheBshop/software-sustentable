// Indicadores de la guía de productividad para plantas de clasificación, calculados con un
// mes armado a mano (marzo de 2020) para poder comprobar cada número.
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setupSeed, NV, LITORAL, EMPRESA } from './helpers.js';

const app = createApp();
let ctx;
let mat;
let comprador;
const MES = '2020-03';
beforeAll(async () => {
  ctx = await setupSeed(app);
  const h = ctx.as(NV);
  mat = Object.fromEntries((await request(app).get('/api/materiales?limit=200').set(h)).body.items.map((m) => [m.codigo, m]));
  comprador = (await request(app).get('/api/clientes?limit=200').set(h)).body.items.find((c) => c.tipo === 'comprador');
  const post = (p, b) => request(app).post(`/api${p}`).set(h).send(b).expect((r) => { if (r.status >= 400) throw new Error(`${p}: ${JSON.stringify(r.body)}`); });

  // Un camión municipal (6 t) y 1 t de cartón de recuperadores
  await post('/ingresos', { fecha: '2020-03-02', origen: 'recoleccion_municipal', items: [{ material: mat.MEZCLA._id, cantidad: 1, unidad: 'camión' }] });
  await post('/ingresos', { fecha: '2020-03-03', origen: 'recuperador', items: [{ material: mat.CART._id, pesoKg: 1000 }] });
  // Se clasifican 900 kg de cartón y 100 de PET; 4 t van a disposición final
  await post('/planta/clasificacion', { fecha: '2020-03-04', desde: mat.MEZCLA._id, items: [{ material: mat.CART._id, kg: 900 }, { material: mat.PET._id, kg: 100 }], rechazoKg: 4000, causa: 'mezclado' });
  // Venta: 1.500 kg de cartón a $150 y 100 kg de PET a $300 = $255.000
  await post('/ventas', { fecha: '2020-03-20', comprador: comprador._id, items: [{ material: mat.CART._id, pesoKg: 1500, precioKg: 150 }, { material: mat.PET._id, pesoKg: 100, precioKg: 300 }] });
  // 6 horas de cinta parada y un accidente con 4 días perdidos
  await post('/productividad/paradas', { fecha: '2020-03-10', maquina: 'cinta', horas: 6, causa: 'rotura' });
  await post('/productividad/paradas', { fecha: '2020-03-11', maquina: 'prensa', horas: 3 });
  await post('/seguridad', { fecha: '2020-03-05', tipo: 'accidente', persona: 'Ana', diasPerdidos: 4, observaciones: 'Corte en la cinta' });
}, 60_000);
afterAll(() => ctx.teardown());

const get = (mes, quien = NV) => request(app).get(`/api/productividad?mes=${mes}`).set(ctx.as(quien));
const ind = (body, clave) => body.indicadores.find((i) => i.clave === clave);

describe('Datos que salen solos de los registros', () => {
  it('ingresado, separado, rechazo y ventas del mes', async () => {
    const { body } = await get(MES).expect(200);
    expect(body.datos).toMatchObject({ ingresadoTn: 7, separadoTn: 2, rechazoTn: 4, vendidoTn: 1.6, facturado: 255000, tiposSeparados: 2, tiposVendidos: 2, accidentes: 1, diasPerdidosAccidentes: 4 });
    expect(body.datos.horasParada).toMatchObject({ cinta: 6, prensa: 3 });
    expect(ind(body, 'rechazo').valor).toBe(57.14);
    expect(ind(body, 'eficiencia_venta').valor).toBe(100);
    expect(ind(body, 'precio_promedio').valor).toBe(159.38);
    expect(ind(body, 'utilizacion').valor).toBe(1.17); // 7 t sobre 600 t de capacidad (seed)
    expect(ind(body, 'cinta_parada').valor).toBe(3.41); // 6 h sobre 176 h
  });

  it('sin el personal del mes, dice qué falta cargar', async () => {
    const { body } = await get(MES).expect(200);
    expect(body.indiceProductividad).toBeNull();
    expect(ind(body, 'productividad')).toMatchObject({ valor: null, falta: 'Cargá cuántas personas trabajaron en el mes' });
  });
});

describe('Con el personal del mes', () => {
  it('calcula el índice de productividad y los indicadores de personal', async () => {
    await request(app).put(`/api/productividad/personal/${MES}`).set(ctx.as(NV)).send({ personas: 10, formalizadas: 12 }).expect(400);
    await request(app).put(`/api/productividad/personal/${MES}`).set(ctx.as(NV)).send({ personas: 9 }).expect(200);
    const p = await request(app).put(`/api/productividad/personal/${MES}`).set(ctx.as(NV)).send({ personas: 10, formalizadas: 6, diasTrabajados: 200, diasAusencia: 10, bajas: 1, ingresoPromedio: 400000, smvm: 320000 }).expect(200);
    expect(p.body.personas).toBe(10); // el segundo PUT reemplaza al primero

    const { body } = await get(MES).expect(200);
    expect(body.indiceProductividad).toBe(0.16); // 1,6 t vendidas / 10 personas
    expect(ind(body, 'productividad').valor).toBe(0.2); // 2 t separadas / 10 personas
    expect(ind(body, 'ingresos').valor).toBe(1.25);
    expect(ind(body, 'formalizacion').valor).toBe(60);
    expect(ind(body, 'ausentismo').valor).toBe(5);
    expect(ind(body, 'accidentes').valor).toBe(2);
    expect(ind(body, 'rotacion').valor).toBe(10);
    expect(body.evolucion).toHaveLength(6);
    expect(body.evolucion.at(-1)).toMatchObject({ mes: MES, indiceProductividad: 0.16 });
  });
});

describe('Permisos y aislamiento', () => {
  it('otra cooperativa no ve los datos de este mes', async () => {
    const { body } = await get(MES, LITORAL).expect(200);
    expect(body.datos.ingresadoTn).toBe(0);
    expect(body.personal).toBeNull();
  });

  it('el chofer y el portal de clientes no acceden', async () => {
    const token = (await request(app).post('/api/auth/login').send({ email: 'chofer@nuevavida.local', password: 'chofer1234' })).body.token;
    await request(app).get('/api/productividad').set('Authorization', `Bearer ${token}`).expect(403);
    await request(app).get('/api/productividad').set(ctx.as(EMPRESA)).expect(403);
  });

  it('los accidentes no aparecen como personas sin EPP en Seguridad', async () => {
    const { body } = await request(app).get('/api/seguridad/resumen').set(ctx.as(NV)).expect(200);
    expect(body.items.map((p) => p.persona)).not.toContain('Ana');
  });
});
