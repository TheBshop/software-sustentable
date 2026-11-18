// Prototipos a medida: las 33 organizaciones relevadas, con sus materiales, su marco normativo
// según provincia y municipio, aislamiento entre ellas y el modo demostración.
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { env } from '../src/config/env.js';
import { createApp } from '../src/app.js';
import { setupSeed, NV, EMPRESA } from './helpers.js';
import { ENTIDADES } from '../src/demo/entidades.js';
import { crearTodos, crearPrototipo } from '../src/demo/prototipos.js';
import { runWithoutTenant } from '../src/lib/tenancy.js';
import { PROVINCIAS } from '../src/modules/normativa/jurisdicciones.js';
import { CATALOGO } from '../src/modules/materials/catalogo.js';

env.demoMode = true; // el modo demostración se lee al crear la app
const app = createApp();
let ctx;
const tokens = {};
beforeAll(async () => {
  ctx = await setupSeed(app);
  await runWithoutTenant(() => crearTodos({ password: 'clave-de-prueba' }));
}, 120_000);
afterAll(() => ctx.teardown());

async function como(slug) {
  tokens[slug] ??= (await request(app).post('/api/auth/login').send({ email: `admin@${slug}.demo`, password: 'clave-de-prueba' }).expect(200)).body.token;
  return { Authorization: `Bearer ${tokens[slug]}` };
}

describe('Datos de los prototipos', () => {
  it('cada entidad usa materiales del catálogo y una provincia con normativa cargada', () => {
    expect(ENTIDADES).toHaveLength(33);
    for (const e of ENTIDADES) {
      for (const c of e.materiales) expect(CATALOGO[c], `${e.slug}: ${c}`).toBeDefined();
      expect(PROVINCIAS[e.jurisdiccion.provincia], e.slug).toBeDefined();
    }
  });

  it('los contactos no se guardan en el código (el repositorio es público)', () => {
    const texto = JSON.stringify(ENTIDADES);
    expect(texto).not.toMatch(/@|\+54|\(0\d{2,4}\)|0800/);
  });

  it('no se puede crear dos veces el mismo prototipo', async () => {
    await expect(runWithoutTenant(() => crearPrototipo('promapla', { password: 'x' }))).rejects.toThrow('ya existe');
  });
});

describe('Cada prototipo funciona con lo suyo', () => {
  it('todos tienen sus materiales, retiros, certificados y el aviso de prototipo', async () => {
    for (const e of ENTIDADES) {
      const h = await como(e.slug);
      const mats = (await request(app).get('/api/materiales?limit=200').set(h).expect(200)).body.items.map((m) => m.codigo);
      expect(mats, e.slug).toEqual(expect.arrayContaining(e.materiales));
      expect(mats.includes('MEZCLA'), e.slug).toBe(Boolean(e.recibeMezcla));
      const retiros = (await request(app).get('/api/retiros').set(h)).body;
      expect(retiros.total, e.slug).toBe(9);
      const org = (await request(app).get('/api/planta/organizacion').set(h)).body;
      expect(org.prototipo.slug).toBe(e.slug);
    }
  }, 60_000);

  it('una organización especializada en RAEE trabaja con la corriente REGU habilitada', async () => {
    const org = (await request(app).get('/api/planta/organizacion').set(await como('cooperativa-ren'))).body;
    expect(org.habilitaciones.corrientes).toEqual(expect.arrayContaining(['rsu', 'regu']));
    const ventas = (await request(app).get('/api/ventas').set(await como('cooperativa-ren'))).body.items;
    expect(ventas).toHaveLength(1);
  });

  it('los prototipos no ven datos de otras organizaciones', async () => {
    const quanta = (await request(app).get('/api/clientes?limit=200').set(await como('quanta'))).body.items.map((c) => c.razonSocial);
    expect(quanta).not.toContain('Supermercado El Puente SA');
    const nv = (await request(app).get('/api/clientes?limit=200').set(ctx.as(NV))).body.items.map((c) => c.razonSocial);
    expect(nv).not.toContain('Comercio de ejemplo');
  });
});

describe('Marco normativo según la jurisdicción', () => {
  const marco = async (slug) => (await request(app).get('/api/normativa').set(await como(slug)).expect(200)).body;

  it('Córdoba Capital: Ley 9.088 y la ordenanza de grandes generadores', async () => {
    const m = await marco('la-esperanza-cordoba');
    expect(m.jurisdiccion).toMatchObject({ provincia: 'Córdoba', municipio: 'Córdoba Capital' });
    expect(m.provincial.map((n) => n.norma)).toContain('Ley 9.088');
    expect(m.municipal[0].norma).toContain('12.648');
    expect(m.grandesGeneradores.umbralKgDia).toBe(200);
  });

  it('Provincia de Buenos Aires: generador especial desde 1.000 kg por mes', async () => {
    const m = await marco('ucp-la-plata');
    expect(m.grandesGeneradores).toMatchObject({ umbralKgMes: 1000, verificado: true });
    expect(m.cobertura.map((c) => c.clave)).toContain('regu'); // Ley 14.321 de RAEE
  });

  it('La Pampa avisa que no hay ley provincial GIRSU', async () => {
    const m = await marco('brote-popular');
    expect(m.provincial).toHaveLength(0);
    expect(m.notas[0]).toContain('competencia municipal');
    expect(m.nacional.length).toBeGreaterThan(3); // siempre aplican las nacionales
  });

  it('Nueva Vida ve la Ordenanza 9.233 de Paraná', async () => {
    const m = (await request(app).get('/api/normativa').set(ctx.as(NV)).expect(200)).body;
    expect(m.municipal[0].norma).toContain('9.233');
    expect(m.cobertura.find((c) => c.clave === 'seguridad_personal').donde).toBe('Seguridad e higiene');
  });

  it('el portal de clientes no accede al marco de las cooperativas', async () => {
    await request(app).get('/api/normativa').set(ctx.as(EMPRESA)).expect(403);
  });
});

describe('Modo demostración', () => {
  it('lista los prototipos y entra sin contraseña como admin o chofer', async () => {
    const { body } = await request(app).get('/api/demo/prototipos').expect(200);
    expect(body.items).toHaveLength(33);
    expect(JSON.stringify(body)).not.toContain('@');
    const admin = (await request(app).post('/api/demo/entrar').send({ slug: 'bella-flor' }).expect(200)).body;
    expect(admin.user).toMatchObject({ rol: 'admin', organizacion: { nombre: 'Cooperativa Bella Flor Ltda.' } });
    const chofer = (await request(app).post('/api/demo/entrar').send({ slug: 'bella-flor', rol: 'chofer' }).expect(200)).body;
    expect(chofer.user.rol).toBe('chofer');
  });

  it('no sirve para entrar a organizaciones reales', async () => {
    await request(app).post('/api/demo/entrar').send({ slug: 'nuevavida.local' }).expect(404);
    await request(app).post('/api/demo/entrar').send({ slug: 'no-existe' }).expect(404);
  });

  it('sin el modo demostración la ruta no existe', async () => {
    env.demoMode = false;
    const sinDemo = createApp();
    env.demoMode = true;
    await request(sinDemo).get('/api/demo/prototipos').expect(401); // cae en la zona privada
  });
});
