// Funciones tomadas del análisis de plataformas (Rubicon, Routeware, Sensoneo, Enevo, Recy,
// Reaquila): pedidos de retiro, hoja de ruta, frecuencia sugerida, costo por recorrido y
// compras a recuperadores.
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setupSeed, NV, LITORAL, EMPRESA, MUNICIPIO } from './helpers.js';
import { ordenarParadas } from '../src/modules/logistica/logistica.routes.js';

const app = createApp();
let ctx;
let mat;
let cli;
let chofer;
const hoy = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
beforeAll(async () => {
  ctx = await setupSeed(app);
  mat = Object.fromEntries((await get(NV, '/materiales?limit=200')).body.items.map((m) => [m.codigo, m]));
  cli = Object.fromEntries((await get(NV, '/clientes?limit=200')).body.items.map((c) => [c.razonSocial.split(' ')[0], c]));
  chofer = (await request(app).post('/api/auth/login').send({ email: 'chofer@nuevavida.local', password: 'chofer1234' })).body.token;
});
afterAll(() => ctx.teardown());

const get = (who, p) => request(app).get(`/api${p}`).set(ctx.as(who));
const send = (who, method, p, b) => request(app)[method](`/api${p}`).set(ctx.as(who)).send(b);
const comoChofer = (method, p, b) => request(app)[method](`/api${p}`).set('Authorization', `Bearer ${chofer}`).send(b);

describe('Pedidos de retiro desde el portal', () => {
  let pedido;
  it('la empresa pide un retiro y le llega a su cooperativa, no a otra', async () => {
    const org = (await get(EMPRESA, '/v1/portal/organizacion')).body;
    expect(org.servicios).toHaveLength(2); // la atienden dos cooperativas
    const servicioNV = org.servicios.find((s) => s.cooperativa === 'Cooperativa Nueva Vida');
    const r = await send(EMPRESA, 'post', '/v1/portal/solicitudes', { cliente: servicioNV.cliente, detalle: '5 bolsones de cartón', kgEstimados: 120 }).expect(201);
    pedido = r.body.id;
    const nv = (await get(NV, '/solicitudes?estado=pendiente')).body.items;
    expect(nv.map((s) => s._id)).toContain(pedido);
    expect(nv.find((s) => s._id === pedido).origen).toBe('portal');
    const litoral = (await get(LITORAL, '/solicitudes?estado=pendiente')).body.items;
    expect(litoral.map((s) => s._id)).not.toContain(pedido);
  });

  it('no se puede pedir a nombre de otro cliente', async () => {
    await send(EMPRESA, 'post', '/v1/portal/solicitudes', { cliente: cli.Hotel._id, detalle: 'algo' }).expect(404);
    await send(MUNICIPIO, 'post', `/v1/portal/solicitudes/${pedido}/cancelar`).expect(404);
  });

  it('la cooperativa lo programa con fecha y chofer y la empresa lo ve programado', async () => {
    const choferes = (await get(NV, '/solicitudes/choferes')).body.items;
    expect(choferes.map((c) => c.nombre)).toContain('Camión 1');
    const r = await send(NV, 'patch', `/solicitudes/${pedido}`, { fechaProgramada: hoy(), chofer: choferes[0]._id }).expect(200);
    expect(r.body.estado).toBe('programada');
    const delPortal = (await get(EMPRESA, '/v1/portal/solicitudes')).body.items.find((s) => s.id === pedido);
    expect(delPortal.estado).toBe('programada');
  });

  it('el chofer lo ve en su hoja de ruta y al registrar el retiro queda realizado', async () => {
    const hoja = (await comoChofer('get', '/hoja-de-ruta')).body;
    const parada = hoja.paradas.find((p) => p.id === pedido);
    expect(parada).toBeDefined();
    expect(hoja.paradas.length).toBeGreaterThanOrEqual(3); // más los dos programados del seed
    await comoChofer('post', '/retiros', { cliente: cli.Hotel._id, solicitud: pedido, items: [{ material: mat.CART._id, pesoEstimadoKg: 10 }] }).expect(422); // otro cliente
    const r = await comoChofer('post', '/retiros', { cliente: cli.Supermercado._id, solicitud: pedido, items: [{ material: mat.CART._id, pesoEstimadoKg: 110 }], ubicacion: { lat: -31.73, lng: -60.53 } }).expect(201);
    const s = (await get(NV, '/solicitudes?estado=realizada')).body.items.find((x) => x._id === pedido);
    expect(s.retiro).toBe(r.body._id);
  });

  it('una visita fallida guarda el motivo y el cliente lo ve', async () => {
    const s = (await send(NV, 'post', '/solicitudes', { cliente: cli.Supermercado._id, detalle: 'film', fechaProgramada: hoy() }).expect(201)).body;
    await comoChofer('post', `/solicitudes/${s._id}/no-realizado`, { motivo: 'cualquiera' }).expect(400);
    await comoChofer('post', `/solicitudes/${s._id}/no-realizado`, { motivo: 'material_mezclado', detalle: 'Bolsas con restos de comida' }).expect(200);
    await comoChofer('post', `/solicitudes/${s._id}/no-realizado`, { motivo: 'cerrado' }).expect(409); // ya informado
    const delPortal = (await get(EMPRESA, '/v1/portal/solicitudes')).body.items.find((x) => x.id === s._id);
    expect(delPortal).toMatchObject({ estado: 'no_realizada', noRealizado: 'Material mezclado con basura' });
  });
});

describe('Hoja de ruta', () => {
  it('ordena por cercanía y deja al final las paradas sin ubicación', () => {
    const p = (id, lat, lng) => ({ id, ubicacion: lat == null ? null : { lat, lng } });
    const { paradas, kmEstimados } = ordenarParadas([p('lejos', -31.9, -60.3), p('sin'), p('cerca', -31.74, -60.53), p('medio', -31.8, -60.45)], { lat: -31.73, lng: -60.53 });
    expect(paradas.map((x) => x.id)).toEqual(['cerca', 'medio', 'lejos', 'sin']);
    expect(kmEstimados).toBeGreaterThan(0);
    expect(paradas.at(-1).tramoKm).toBeNull();
  });
});

describe('Frecuencia sugerida', () => {
  it('sugiere cada cuánto volver a los clientes con historial', async () => {
    const { body } = await get(NV, '/solicitudes/sugeridos').expect(200);
    expect(body.items.length).toBeGreaterThan(0);
    for (const s of body.items) {
      expect(s.retiros).toBeGreaterThanOrEqual(3);
      expect(s.intervaloSugeridoDias).toBeGreaterThanOrEqual(1);
      expect(['atrasado', 'toca', 'al_dia', 'con_pedido']).toContain(s.estado);
    }
  });

  it('con una carga objetivo, el intervalo sale de los kilos que junta cada cliente', async () => {
    const antes = (await get(NV, '/solicitudes/sugeridos')).body.items[0];
    await send(NV, 'patch', '/logistica/configuracion', { kgObjetivoRetiro: antes.kgPorRetiro * 2 }).expect(200);
    const despues = (await get(NV, '/solicitudes/sugeridos')).body.items.find((s) => s.cliente.id === antes.cliente.id);
    expect(despues.intervaloSugeridoDias).toBe(Math.max(1, Math.round((antes.kgPorRetiro * 2) / antes.kgPorDia)));
    await send(NV, 'patch', '/logistica/configuracion', { kgObjetivoRetiro: null }).expect(200);
  });
});

describe('Costo por recorrido', () => {
  it('kilos por retiro, combustible por tonelada y pedidos cumplidos del mes', async () => {
    const { body } = await get(NV, `/logistica?mes=${hoy().slice(0, 7)}`).expect(200);
    expect(body.retiros).toBeGreaterThan(0);
    expect(body.kgPorRetiro).toBeCloseTo(body.kg / body.retiros, 1);
    if (body.gastoCombustible) expect(body.combustiblePorTonelada).toBeCloseTo(body.gastoCombustible / (body.kg / 1000), 0);
    expect(body.pedidos.noRealizados).toBeGreaterThanOrEqual(1);
    expect(body.porChofer[0].chofer).toBe('Camión 1');
    await comoChofer('get', '/logistica').expect(403);
  });
});

describe('Recuperadores y compras', () => {
  let rec;
  it('registra una compra: entra al stock y sale con su número', async () => {
    rec = (await send(NV, 'post', '/recuperadores', { nombre: 'Juan Recuperador', zona: 'Barrio Sur' }).expect(201)).body;
    const stock = async () => (await get(NV, '/planta/stock')).body.items.find((s) => s.materialId === mat.CART._id)?.kg ?? 0;
    const antes = await stock();
    const c = (await send(NV, 'post', '/compras', { recuperador: rec._id, items: [{ material: mat.CART._id, cantidad: 2, unidad: 'fardo', precioKg: 70 }] }).expect(201)).body;
    expect(c.items[0]).toMatchObject({ pesoKg: 120, estimado: true }); // 2 fardos de 60 kg
    expect(c.total).toBe(8400);
    expect(c.numero).toBeGreaterThan(3); // sigue después de las de ejemplo
    expect(await stock()).toBe(antes + 120);
    const pdf = await get(NV, `/compras/${c._id}/recibo.pdf`).buffer(true).expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
  });

  it('al pagarla entra al balance como egreso', async () => {
    const mes = hoy().slice(0, 7);
    const balance = async () => (await get(NV, `/balance?desde=${mes}-01`)).body;
    const antes = await balance();
    const c = (await get(NV, '/compras')).body.items.find((x) => !x.pagada && x.recuperador.nombre === 'Juan Recuperador');
    await send(NV, 'patch', `/compras/${c._id}`, { pagada: true, medioPago: 'transferencia' }).expect(200);
    const despues = await balance();
    expect(despues.egresos.total).toBe(antes.egresos.total + 8400);
    expect(despues.egresos.porCategoria.find((x) => x.categoria === 'compras_material').monto).toBeGreaterThanOrEqual(8400);
  });

  it('resumen del mes por recuperador', async () => {
    const { body } = await get(NV, `/recuperadores/resumen?mes=${hoy().slice(0, 7)}`).expect(200);
    const juan = body.items.find((r) => r.recuperador === 'Juan Recuperador');
    expect(juan).toMatchObject({ compras: 1, kg: 120, monto: 8400, pendiente: 0, precioPromedioKg: 70 });
  });

  it('otra cooperativa no ve los recuperadores ni las compras', async () => {
    const litoral = (await get(LITORAL, '/recuperadores?limit=200')).body.items.map((r) => r.nombre);
    expect(litoral).not.toContain('Juan Recuperador');
    await comoChofer('get', '/compras').expect(403);
  });
});
