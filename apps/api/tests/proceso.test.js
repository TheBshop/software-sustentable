import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setupSeed, NV, LITORAL } from './helpers.js';

const app = createApp();
let ctx;
let carton;
let mezcla;
let otro;
let comprador;
beforeAll(async () => {
  ctx = await setupSeed(app);
  const mats = (await request(app).get('/api/materiales?limit=200').set(ctx.as(NV))).body.items;
  carton = mats.find((m) => !m.mezcla && m.nombre.startsWith('Cartón'));
  otro = mats.find((m) => !m.mezcla && m._id !== carton._id && m.corriente === 'rsu');
  mezcla = mats.find((m) => m.mezcla);
  comprador = (await request(app).get('/api/clientes?tipo=comprador').set(ctx.as(NV))).body.items[0];
});
afterAll(() => ctx.teardown());

const as = (email) => ctx.as(email);
const stockDe = async (material) => (await request(app).get('/api/planta/stock').set(as(NV))).body.items?.find((s) => String(s.materialId) === String(material))?.kg ?? 0;
const ultimoLote = async (material) => (await request(app).get('/api/lotes').set(as(NV))).body.items.find((l) => l.material._id === material && l.etapa === 'recepcion');

describe('Lotes', () => {
  let lote;
  it('cada ingreso abre un lote por material', async () => {
    await request(app).post('/api/ingresos').set(as(NV)).send({ origen: 'recuperador', items: [{ material: carton._id, pesoKg: 1000 }] }).expect(201);
    lote = await ultimoLote(carton._id);
    expect(lote).toMatchObject({ kg: 1000, kgIngreso: 1000, etapa: 'recepcion', control: 'Sin controlar' });
    expect(lote.codigo).toMatch(/^L-\d{4}$/);
  });

  it('clasificar registra el rechazo en el libro y valida los kg', async () => {
    await request(app).post(`/api/lotes/${lote._id}/clasificar`).set(as(NV)).send({ kgSeparado: 900, kgRechazo: 300 }).expect(422);
    const antes = await stockDe(carton._id);
    const r = await request(app).post(`/api/lotes/${lote._id}/clasificar`).set(as(NV)).send({ control: 'Húmedo', humedad: 18, kgSeparado: 900, kgRechazo: 80, causaRechazo: 'humedad' }).expect(200);
    expect(r.body.lote).toMatchObject({ etapa: 'clasificado', kg: 900, kgRechazo: 80 });
    expect(await stockDe(carton._id)).toBeCloseTo(antes - 80);
    await request(app).post(`/api/lotes/${lote._id}/clasificar`).set(as(NV)).send({ kgSeparado: 1 }).expect(409);
  });

  it('enfardar registra la merma', async () => {
    const antes = await stockDe(carton._id);
    const r = await request(app).post(`/api/lotes/${lote._id}/enfardar`).set(as(NV)).send({ unidades: 4, kgFinal: 880 }).expect(200);
    expect(r.body.mermaKg).toBe(20);
    expect(await stockDe(carton._id)).toBeCloseTo(antes - 20);
  });

  it('vender crea la venta y el remito con numeración correlativa', async () => {
    const r = await request(app).post('/api/lotes/vender').set(as(NV)).send({ comprador: comprador._id, items: [{ lote: lote._id, kg: 880, precioKg: 150 }], transporte: { patente: 'AB123CD' } }).expect(201);
    expect(r.body.venta.total).toBe(132000);
    const remitos = (await request(app).get('/api/remitos').set(as(NV))).body.items;
    expect(remitos[0]).toMatchObject({ numero: 1, codigo: 'R-000001', kg: 880, tipo: 'venta' });
    const vendido = (await request(app).get('/api/lotes?etapa=vendido').set(as(NV))).body.items.find((l) => l._id === lote._id);
    expect(vendido.remito.numero).toBe(1);
    const pdf = await request(app).get(`/api/remitos/${remitos[0]._id}/pdf`).set(as(NV)).expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
  });

  it('si un lote no está listo, no se guarda nada (ni venta ni remito)', async () => {
    await request(app).post('/api/ingresos').set(as(NV)).send({ origen: 'recuperador', items: [{ material: otro._id, pesoKg: 200 }] }).expect(201);
    const crudo = await ultimoLote(otro._id);
    const ventasAntes = (await request(app).get('/api/ventas').set(as(NV))).body.total;
    await request(app).post('/api/lotes/vender').set(as(NV)).send({ comprador: comprador._id, items: [{ lote: crudo._id, kg: 200, precioKg: 10 }] }).expect(409);
    expect((await request(app).get('/api/ventas').set(as(NV))).body.total).toBe(ventasAntes);
    expect((await request(app).get('/api/remitos').set(as(NV))).body.items).toHaveLength(1);
  });

  it('el remito no se borra: se anula, y la numeración sigue', async () => {
    const [r1] = (await request(app).get('/api/remitos').set(as(NV))).body.items;
    await request(app).post(`/api/remitos/${r1._id}/anular`).set(as(NV)).send({ motivo: 'Error en el destinatario' }).expect(200);
    await request(app).post(`/api/remitos/${r1._id}/anular`).set(as(NV)).send({ motivo: 'Otra vez' }).expect(409);
    // otra organización arranca su propia numeración
    expect((await request(app).get('/api/remitos').set(as(LITORAL))).body.items).toHaveLength(0);
  });

  it('un lote mezclado se clasifica en lotes por material', async () => {
    await request(app).post('/api/ingresos').set(as(NV)).send({ origen: 'recoleccion_municipal', items: [{ material: mezcla._id, pesoKg: 3000 }] }).expect(201);
    const lote = await ultimoLote(mezcla._id);
    await request(app).post(`/api/lotes/${lote._id}/clasificar`).set(as(NV)).send({ kgSeparado: 100 }).expect(422);
    const r = await request(app)
      .post(`/api/lotes/${lote._id}/clasificar`)
      .set(as(NV))
      .send({ control: 'Mezclado', items: [{ material: carton._id, kg: 900 }, { material: otro._id, kg: 300 }], kgRechazo: 1500, causaRechazo: 'mezclado' })
      .expect(200);
    expect(r.body).toMatchObject({ derivados: 2, lote: { etapa: 'derivado' } });
    const clasificados = (await request(app).get('/api/lotes?etapa=clasificado').set(as(NV))).body.items;
    expect(clasificados.filter((l) => l.origen.lote === lote._id).map((l) => l.kg).sort()).toEqual([300, 900]);
  });

  it('el mapa del proceso cuenta lotes y kg por etapa', async () => {
    const r = await request(app).get('/api/proceso').set(as(NV)).expect(200);
    const e = Object.fromEntries(r.body.etapas.map((x) => [x.id, x]));
    expect(e.clasificado.lotes).toBeGreaterThanOrEqual(2);
    expect(e.recepcion.kg).toBeGreaterThan(0);
  });
});

describe('Rutinas', () => {
  it('marca y desmarca tareas del período, y suma tareas propias', async () => {
    const r = await request(app).get('/api/rutinas').set(as(NV)).expect(200);
    expect(r.body.puestos.proceso).toBe('Enfardado (prensa)');
    const t = r.body.tareas.find((x) => x.id === 'r1');
    expect(t.hecha).toBeNull();
    await request(app).post('/api/rutinas/hechas').set(as(NV)).send({ tarea: 'r1', hecha: true }).expect(200);
    await request(app).post('/api/rutinas/hechas').set(as(NV)).send({ tarea: 'r1', hecha: true }).expect(200); // idempotente
    const r2 = await request(app).get('/api/rutinas').set(as(NV));
    expect(r2.body.tareas.find((x) => x.id === 'r1').hecha).not.toBeNull();
    expect(r2.body.tareas.find((x) => x.id === 'r1').dias.at(-1)).toBe(true);
    await request(app).post('/api/rutinas/hechas').set(as(NV)).send({ tarea: 'r1', hecha: false }).expect(200);

    const nueva = await request(app).post('/api/rutinas/tareas').set(as(NV)).send({ puesto: 'acopio', t: 'Fumigar el galpón', f: 'm' }).expect(201);
    await request(app).delete('/api/rutinas/tareas/r1').set(as(NV)).expect(404);
    await request(app).delete(`/api/rutinas/tareas/${nueva.body.id}`).set(as(NV)).expect(204);
    const panel = await request(app).get('/api/panel').set(as(NV));
    expect(panel.body.avisos.some((a) => a.texto.includes('sin marcar hoy'))).toBe(true);
  });
});

describe('Tratamientos por corriente', () => {
  it('registra partidas, avisa parámetros fuera de rango y calcula el rendimiento', async () => {
    await request(app).patch('/api/planta/organizacion/configuracion').set(as(NV)).send({ corrientes: ['plasticos', 'compostaje'] }).expect(200);
    const hoy = new Date().toISOString().slice(0, 10);
    await request(app).post('/api/tratamientos/compostaje').set(as(NV)).send({ fecha: hoy, entrada: 100, salidas: { Compost: 120 } }).expect(422);
    await request(app).post('/api/tratamientos/compostaje').set(as(NV)).send({ fecha: hoy, entrada: 100, salidas: { Inventado: 1 } }).expect(400);
    const p = await request(app).post('/api/tratamientos/compostaje').set(as(NV)).send({ fecha: hoy, lote: 'Pila 3', entrada: 100, salidas: { Compost: 45 }, rechazo: 10, params: { temp: 48, humedad: 55 } }).expect(201);
    expect(p.body.avisos).toEqual(['Temperatura máxima fuera del rango aceptable']);
    await request(app).put('/api/tratamientos/compostaje/etapas').set(as(NV)).send({ etapas: [0, 2, 2] }).expect(200);
    const r = await request(app).get('/api/tratamientos').set(as(NV)).expect(200);
    const c = r.body.corrientes.find((x) => x.id === 'compostaje');
    expect(c.etapasHechas).toEqual([0, 2]);
    expect(c.indicadores).toMatchObject({ partidas: 1, entrada: 100, salidas: 45, rendimiento: 45, rechazo: 10, sinRegistrar: 45, fueraDeRango: 1 });
  });
});
