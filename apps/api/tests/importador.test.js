import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { buildTemplate, parseWorkbook, applyImport } from '../src/import/importer.js';
import { Material } from '../src/modules/materials/material.model.js';
import { Client } from '../src/modules/clients/client.model.js';
import { Organization } from '../src/modules/organizations/organization.model.js';
import { enterTenant } from '../src/lib/tenancy.js';

let mongo;
let coop;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  coop = await Organization.create({ tipo: 'cooperativa', nombre: 'Coop Import', cuit: '30700000097' });
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
beforeEach(async () => {
  enterTenant(coop._id);
  await Material.deleteMany({});
  await Client.deleteMany({});
});

/** Completa la plantilla como lo haría la cooperativa y la pasa por un .xlsx real (escribir + leer). */
async function planilla({ materiales = [], clientes = [] }) {
  const wb = buildTemplate();
  // Desde la fila 2, como cuando alguien tipea en Excel (addRow escribiría después de las
  // 500 filas que ya tienen listas desplegables).
  materiales.forEach((r, i) => (wb.getWorksheet('Materiales').getRow(i + 2).values = r));
  clientes.forEach((r, i) => (wb.getWorksheet('Clientes').getRow(i + 2).values = r));
  const buffer = await wb.xlsx.writeBuffer();
  const leido = new ExcelJS.Workbook();
  await leido.xlsx.load(buffer);
  return leido;
}

const MATS = [
  ['cart', 'Cartón', 'Papel y cartón', 0.9, 0, '120'],
  ['VID', 'Vidrio', 'vidrio', '0,3', 15, '30'],
];
// Razón social, CUIT, Tipo, IVA, Contacto, Email, WhatsApp, Dirección, Modalidad, Monto, Precios/kg, N° contrato, Inicio, Fin, Frecuencia, Días
const HOTEL = ['Hotel Test SRL', '30-71234567-8', 'Generador', 'Responsable inscripto', 'Ana', 'ana@hotel.test', '+54 9 343 412-3456', 'Calle 1', 'Por kg', '', 'VID=25; CART=8', 'GG-1', '01/03/2026', new Date(Date.UTC(2027, 1, 28)), 'semanal', 10];

describe('Importador desde Excel', () => {
  it('la plantilla trae hojas, encabezados y listas desplegables', () => {
    const wb = buildTemplate();
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Instrucciones', 'Materiales', 'Clientes']);
    expect(wb.getWorksheet('Clientes').getRow(1).getCell(1).value).toBe('Razón social');
    expect(wb.getWorksheet('Clientes').getCell('I2').dataValidation.formulae[0]).toContain('Por retiro');
  });

  it('importa materiales y clientes con tarifas, precios por kg y contrato', async () => {
    enterTenant(coop._id);
    const parsed = parseWorkbook(await planilla({ materiales: MATS, clientes: [HOTEL, ['Escuela Uno', '', '', '', '', '', '', 'Pasaje 2', 'Abono mensual', '40.000', '', '', '', '', '', '']] }));
    expect(parsed.errores).toEqual([]);

    const r = await applyImport(parsed);
    expect(r).toMatchObject({ materiales: { nuevos: 2 }, clientes: { nuevos: 2 }, errores: [] });

    const vid = await Material.findOne({ codigo: 'VID' });
    expect(vid.factorCo2).toBe(0.3);
    const cart = await Material.findOne({ codigo: 'CART' });
    expect(cart.categoria).toBe('papel_carton');

    const hotel = await Client.findOne({ cuit: '30712345678' });
    expect(hotel.contacto.telefono).toBe('5493434123456');
    expect(hotel.tarifa.modalidad).toBe('por_kg');
    expect(hotel.tarifa.preciosPorKg.map((p) => [String(p.material), p.precio])).toEqual([[String(vid._id), 25], [String(cart._id), 8]]);
    expect(hotel.contrato.inicio.toISOString().slice(0, 10)).toBe('2026-03-01');
    expect(hotel.contrato.diasPagoFactura).toBe(10);

    const escuela = await Client.findOne({ razonSocial: 'Escuela Uno' });
    expect(escuela.tarifa).toMatchObject({ modalidad: 'abono_mensual', montoFijo: 40000 });
  });

  it('volver a importar actualiza en vez de duplicar', async () => {
    enterTenant(coop._id);
    await applyImport(parseWorkbook(await planilla({ materiales: MATS, clientes: [HOTEL] })));
    const cambiado = [...HOTEL];
    cambiado[8] = 'Por retiro'; // Modalidad de cobro
    cambiado[9] = 18000; // Monto fijo
    const r = await applyImport(parseWorkbook(await planilla({ materiales: MATS, clientes: [cambiado] })));
    expect(r).toMatchObject({ materiales: { actualizados: 2, nuevos: 0 }, clientes: { actualizados: 1, nuevos: 0 } });
    expect(await Client.countDocuments()).toBe(1);
    expect((await Client.findOne()).tarifa).toMatchObject({ modalidad: 'por_retiro', montoFijo: 18000 });
  });

  it('reporta errores por fila y no guarda nada', async () => {
    enterTenant(coop._id);
    const parsed = parseWorkbook(
      await planilla({
        materiales: [...MATS, ['VID', 'Vidrio repetido', 'Vidrio', 0, 0, 0], ['ALU', 'Aluminio', 'Metal pesado', 9, 0, 0]],
        clientes: [['Malo', '123', 'Generador', '', '', 'no-es-mail', '', '', 'Por kg', '', '', '', '32/13/2026', '', '', '']],
      }),
    );
    const mensajes = parsed.errores.map((e) => `${e.hoja}:${e.fila}`);
    expect(mensajes).toEqual(['Materiales:4', 'Materiales:5', 'Clientes:2']);
    expect(parsed.errores[1].mensaje).toContain('Opciones: Papel y cartón');
    expect(await Material.countDocuments()).toBe(0);
  });

  it('rechaza precios por kg de materiales que no existen', async () => {
    enterTenant(coop._id);
    const sinVidrio = [MATS[0]];
    const r = await applyImport(parseWorkbook(await planilla({ materiales: sinVidrio, clientes: [HOTEL] })));
    expect(r.errores[0].mensaje).toContain('VID no existe');
    expect(await Material.countDocuments()).toBe(0);
  });

  it('revisar (dryRun) no escribe', async () => {
    enterTenant(coop._id);
    const r = await applyImport(parseWorkbook(await planilla({ materiales: MATS, clientes: [HOTEL] })), { dryRun: true });
    expect(r.clientes.nuevos).toBe(1);
    expect(await Client.countDocuments()).toBe(0);
  });
});
