// Clasificador de residuos en los tres niveles y certificado verde con sus 6 requisitos.
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setupSeed, NV, LITORAL, EMPRESA, MUNICIPIO } from './helpers.js';
import { cuitValido, requisitosOrganizacion, validarCertificado } from '../src/modules/certificates/certificado-verde.js';
import { clasificar } from '../src/modules/normativa/clasificador.js';

const app = createApp();
let ctx;
let mat;
let cli;
beforeAll(async () => {
  ctx = await setupSeed(app);
  mat = Object.fromEntries((await get(NV, '/materiales?limit=200')).body.items.map((m) => [m.codigo, m]));
  cli = Object.fromEntries((await get(NV, '/clientes?limit=200')).body.items.map((c) => [c.razonSocial.split(' ')[0], c]));
});
afterAll(() => ctx.teardown());
const get = (who, p) => request(app).get(`/api${p}`).set(ctx.as(who));
const send = (who, method, p, b) => request(app)[method](`/api${p}`).set(ctx.as(who)).send(b);

describe('Clasificador de residuos', () => {
  it('catálogo con los casos comunes', async () => {
    const { body } = await get(NV, '/clasificador/catalogo').expect(200);
    expect(body.catalogo.length).toBe(40);
    expect(body.caracteristicasH.H3).toBe('Líquido inflamable');
  });

  it('cartón de un gran generador: asimilable, R3, certificado verde y la cooperativa lo recibe', async () => {
    const { body } = await send(NV, 'post', '/clasificador', { nombre: 'Cartón', origen: 'gran', cat: 'seco' }).expect(200);
    expect(body).toMatchObject({ provincia: 'entre_rios', perfil: 'cooperativa', regimen: 'asimilable', certificadoVerde: true, operacion: { codigo: 'R3' }, recibe: { estado: 'si' } });
    expect(body.nacional[1]).toBe('Ley 25.916');
    expect(body.municipal[1]).toContain('Gran generador');
  });

  it('una característica H lo vuelve peligroso, con su nombre en cada provincia', async () => {
    const er = (await send(NV, 'post', '/clasificador', { origen: 'industria', cat: 'industrial', h: ['H3'], y: 'Y8' }).expect(200)).body;
    expect(er).toMatchObject({ regimen: 'peligroso', certificadoVerde: false, operacion: { codigo: 'R9' }, recibe: { estado: 'no' } });
    const pba = (await send(NV, 'post', '/clasificador', { origen: 'industria', cat: 'industrial', h: ['H3'], provincia: 'buenos_aires' })).body;
    expect(pba.provincial).toContain('Ley 11.720');
    await send(NV, 'post', '/clasificador', { origen: 'industria', cat: 'inventada' }).expect(400);
  });

  it('se adapta al perfil: municipio, empresa generadora y empresa recicladora', async () => {
    const muni = (await send(MUNICIPIO, 'post', '/v1/portal/clasificador', { origen: 'vivienda', cat: 'pilas' }).expect(200)).body;
    expect(muni).toMatchObject({ perfil: 'municipio', recibe: { respuesta: 'Sí, en los puntos limpios' } });
    const gen = (await send(EMPRESA, 'post', '/v1/portal/clasificador', { origen: 'gran', cat: 'seco' }).expect(200)).body;
    expect(gen.recibe.respuesta).toContain('pedí el certificado verde');
    expect(clasificar({ origen: 'industria', cat: 'industrial', riesgo: 'bajo' }, 'santa_fe', 'empresa').recibe.estado).toBe('si');
    expect(clasificar({ origen: 'salud', cat: 'seco' }, 'caba', 'cooperativa').provincial).toContain('Tipo A');
    expect(clasificar({ origen: 'campo', cat: 'fito_a' }, 'cordoba', 'cooperativa').gestion).toContain('IRAM 12.069');
  });
});

describe('Requisitos de la organización', () => {
  it('Nueva Vida tiene todo cargado; Litoral no', async () => {
    const nv = (await get(NV, '/certificados/requisitos').expect(200)).body;
    expect(nv).toMatchObject({ documento: 'Certificado de valorización', completo: true });
    const lit = (await get(LITORAL, '/certificados/requisitos').expect(200)).body;
    expect(lit.completo).toBe(false);
    expect(lit.items.filter((i) => !i.ok).map((i) => i.texto)).toContain('Habilitación municipal');
  });

  it('una empresa recicladora necesita responsable técnico; la báscula vencida no sirve', () => {
    const base = { cuit: '30700000016', domicilio: 'x', perfil: 'empresa', certificado: { responsable: 'A', cargo: 'B' }, certificadoVerde: { habilitacionMunicipal: '1', caa: '1', registroProvincial: '1', basculaVence: new Date(Date.now() + 1e9), procesos: ['Molienda'] } };
    expect(requisitosOrganizacion(base).find((i) => i.texto === 'Responsable técnico matriculado').ok).toBe(false);
    expect(requisitosOrganizacion(base).some((i) => i.texto === 'Matrícula INAES')).toBe(false);
    const vencida = { ...base, certificadoVerde: { ...base.certificadoVerde, basculaVence: new Date('2020-01-01') } };
    expect(requisitosOrganizacion(vencida).find((i) => i.texto === 'Báscula con calibración vigente').ok).toBe(false);
  });

  it('solo el admin carga los datos; el CUIT se valida', async () => {
    expect(cuitValido('30-70000001-6')).toBe(true);
    expect(cuitValido('30-70000001-4')).toBe(false);
    await send(LITORAL, 'patch', '/planta/organizacion/certificado-verde', { domicilio: 'Ruta 11 km 3', habilitacionMunicipal: 'HM-9', procesos: ['Clasificación', 'Inventado'] }).expect(400);
    const r = await send(LITORAL, 'patch', '/planta/organizacion/certificado-verde', { domicilio: 'Ruta 11 km 3', habilitacionMunicipal: 'HM-9', procesos: ['Clasificación'] }).expect(200);
    expect(r.body.certificadoVerde.habilitacionMunicipal).toBe('HM-9');
  });
});

describe('Certificado emitido', () => {
  async function retiro(pesado, traslado) {
    const r = (await send(NV, 'post', '/retiros', { cliente: cli.Supermercado._id, items: [{ material: mat.CART._id, pesoEstimadoKg: 100 }, { material: mat.RECH._id, pesoEstimadoKg: 8 }], ...(traslado && { traslado }) }).expect(201)).body;
    if (pesado) await send(NV, 'patch', `/retiros/${r._id}`, { estado: 'en_planta', items: [{ material: mat.CART._id, pesoEstimadoKg: 100, pesoRealKg: 96 }, { material: mat.RECH._id, pesoEstimadoKg: 8, pesoRealKg: 6 }] }).expect(200);
    return (await send(NV, 'post', `/retiros/${r._id}/certificado`).expect(201)).body;
  }

  it('pesado en báscula y con remito: vale como certificado de valorización', async () => {
    const c = await retiro(true, { tipo: 'remito', numero: 'R-0001-00099' });
    expect(c.validez).toMatchObject({ completo: true, documento: 'Certificado de valorización', faltan: [] });
    expect(c.balance).toEqual({ recibidoKg: 102, recuperadoKg: 96, rechazoKg: 6 });
    expect(c.traslado).toMatchObject({ tipo: 'remito', numero: 'R-0001-00099' });
    expect(c.transportistaSnapshot.razonSocial).toBe('Cooperativa Nueva Vida'); // transporte propio
    expect(c.materiales.map((m) => m.operacion)).toEqual(['R3', 'D1']);
    expect(c.emisorSnapshot).toMatchObject({ inaes: 'EJEMPLO-INAES', provincia: 'entre_rios' });
    await get(NV, `/certificados/${c._id}/pdf`).buffer(true).expect(200);
    const pub = (await request(app).get(`/api/public/certificados/${c.codigo}`)).body;
    expect(pub.validez.completo).toBe(true);
  });

  it('sin pesar en báscula: sale como constancia y dice qué falta', async () => {
    const c = await retiro(false);
    expect(c.validez.completo).toBe(false);
    expect(c.validez.faltan.map((f) => f.texto)).toContain('Peso neto de cada corriente en báscula calibrada');
    expect(c.traslado.numero).toMatch(/^Retiro N° /); // sin documento, el retiro numerado
    await get(NV, `/certificados/${c._id}/pdf`).buffer(true).expect(200);
    const lista = (await get(NV, '/certificados')).body.items.find((x) => x._id === c._id);
    expect(lista.validez.completo).toBe(false);
  });

  it('en Buenos Aires exige manifiesto de transporte digital', () => {
    const cert = { emisorSnapshot: { nombre: 'Coop', cuit: '30700000016', domicilio: 'x', provincia: 'buenos_aires', inaes: '1', habilitacionMunicipal: '1', caa: '1', registroProvincial: '1', responsable: 'A', cargo: 'B' }, clienteSnapshot: { razonSocial: 'G', cuit: '30712345671', domicilio: 'y' }, transportistaSnapshot: { razonSocial: 'T', cuit: '30700000016' }, traslado: { tipo: 'remito', numero: '1' }, recepcion: { bascula: true }, procesos: ['Clasificación'], balance: { recibidoKg: 10, recuperadoKg: 9, rechazoKg: 1 } };
    expect(validarCertificado(cert)).toMatchObject({ completo: false, documento: 'Certificado de Destino Sustentable' });
    expect(validarCertificado({ ...cert, traslado: { tipo: 'manifiesto', numero: 'M-1' } }).completo).toBe(true);
  });
});
