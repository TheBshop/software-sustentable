import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setupSeed, NV, LITORAL } from './helpers.js';
import { parseCsv } from '../src/modules/import-odoo/csv.js';

const app = createApp();
let ctx;
beforeAll(async () => { ctx = await setupSeed(app); });
afterAll(() => ctx.teardown());
const as = (email) => ctx.as(email);

const upload = (url, token, nombre, csv) => request(app).post(url).set({ Authorization: `Bearer ${token}` }).attach('archivo', Buffer.from(csv, 'utf8'), { filename: nombre, contentType: 'text/csv' });

describe('Parser CSV', () => {
  it('maneja comas, comillas y escape', () => {
    const t = `a,b,c\n1,"con, coma","con ""comilla"""\n2,x,y\n`;
    expect(parseCsv(t)).toEqual([
      { a: '1', b: 'con, coma', c: 'con "comilla"' },
      { a: '2', b: 'x', c: 'y' },
    ]);
  });
  it('autodetecta separador ;', () => {
    expect(parseCsv('a;b;c\n1;2;3\n')).toEqual([{ a: '1', b: '2', c: '3' }]);
  });
  it('salta BOM y filas vacías', () => {
    expect(parseCsv('﻿x,y\n1,2\n\n')).toEqual([{ x: '1', y: '2' }]);
  });
});

describe('Importador Odoo — contactos', () => {
  it('crea 3 contactos con distintos roles y es idempotente', async () => {
    const csv = `name,vat,customer_rank,supplier_rank,email,phone,street,city\nSupermercado Z SA,AR30700000030,1,0,admin@z.com,34301234,Belgrano 123,Paraná\nAcopio Norte SRL,30-71000013-6,0,1,,,,Rosario\nIndustrias Dobles SA,30999000041,1,1,,,,Córdoba\n`;
    const r = await upload('/api/import/odoo/contactos', ctx.tokens[NV], 'contacts.csv', csv).expect(200);
    expect(r.body).toMatchObject({ creados: 3, errores: [] });
    // Segunda vez: todos actualizados
    const r2 = await upload('/api/import/odoo/contactos', ctx.tokens[NV], 'contacts.csv', csv).expect(200);
    expect(r2.body.actualizados).toBe(3);
    // Aislamiento: Litoral no los ve
    const clientes = (await request(app).get('/api/clientes?limit=200').set(as(LITORAL))).body.items;
    expect(clientes.every((c) => c.razonSocial !== 'Supermercado Z SA')).toBe(true);
  });

  it('reporta filas inválidas y continúa', async () => {
    const csv = `name,vat\n,20\nBuenaEmpresa,30111222334\n`;
    const r = await upload('/api/import/odoo/contactos', ctx.tokens[NV], 'c2.csv', csv).expect(200);
    expect(r.body.errores.length).toBe(1);
    expect(r.body.errores[0].fila).toBe(2);
  });
});

describe('Importador Odoo — productos', () => {
  it('crea materiales y mapea corriente por categoría', async () => {
    const csv = `name,default_code,list_price,categ_id/name\nNotebook Lenovo i5,NB-I5,500000,RAEE electrónicos\nCartón mixto,CART-MIX,200,papel_carton\nBatería de litio,BAT-LI,15000,Peligroso\n`;
    const r = await upload('/api/import/odoo/productos', ctx.tokens[NV], 'prods.csv', csv).expect(200);
    expect(r.body.creados).toBe(3);
    const mats = (await request(app).get('/api/materiales?limit=200').set(as(NV))).body.items;
    const nb = mats.find((m) => m.nombre === 'Notebook Lenovo i5');
    expect(nb.corriente).toBe('regu');
    const bat = mats.find((m) => m.nombre === 'Batería de litio');
    expect(bat.corriente).toBe('peligroso');
  });
});

describe('Importador Odoo — facturas', () => {
  it('crea facturas vinculando por CUIT del cliente', async () => {
    const empresa = (await request(app).get('/api/clientes?q=Puente').set(as(NV))).body.items[0];
    expect(empresa.cuit).toBeTruthy();
    const csv = `name,invoice_date,partner_id/vat,amount_total,payment_state\nFC-A-0001,2026-10-01,${empresa.cuit},50000,paid\nFC-A-0002,2026-11-01,${empresa.cuit},80000,not_paid\nFC-A-0003,2026-11-05,30999999999,999,paid\n`;
    const r = await upload('/api/import/odoo/facturas', ctx.tokens[NV], 'inv.csv', csv).expect(200);
    if (r.body.errores.length > 1) console.log('facturas errores:', r.body.errores);
    expect(r.body.creados + r.body.actualizados).toBeGreaterThanOrEqual(2);
    expect(r.body.errores.find((e) => /no encontrado/.test(e.msg))).toBeTruthy();
  });
});

describe('Seguridad', () => {
  it('solo administración puede importar', async () => {
    await upload('/api/import/odoo/contactos', ctx.tokens['chofer@nuevavida.local'], 'x.csv', 'name\n').expect(403);
  });
  it('tipo inválido → 404', async () => {
    await upload('/api/import/odoo/otros', ctx.tokens[NV], 'x.csv', 'name\n').expect(404);
  });
});
