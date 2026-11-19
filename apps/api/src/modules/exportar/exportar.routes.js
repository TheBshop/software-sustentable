// Exportación completa de los datos de la organización como ZIP de CSVs.
// Requisito mínimo por Ley 25.326 (titular puede acceder a sus datos).
import { Router } from 'express';
import archiver from 'archiver';
import { requireRole } from '../../middleware/auth.js';
import { Client } from '../clients/client.model.js';
import { Material } from '../materials/material.model.js';
import { Pickup } from '../pickups/pickup.model.js';
import { Intake, Sale } from '../plant/plant.models.js';
import { Invoice } from '../invoices/invoice.model.js';

const COLECCIONES = [
  { nombre: 'clientes', model: Client, campos: ['razonSocial', 'cuit', 'tipo', 'rubro', 'condicionIva', 'createdAt'] },
  { nombre: 'materiales', model: Material, campos: ['codigo', 'nombre', 'categoria', 'corriente', 'fraccion', 'precioVentaKg', 'tarifaRetiroKg', 'activo'] },
  { nombre: 'retiros', model: Pickup, campos: ['numero', 'fecha', 'cliente', 'estado'] },
  { nombre: 'ingresos', model: Intake, campos: ['fecha', 'origen', 'detalleOrigen'] },
  { nombre: 'ventas', model: Sale, campos: ['fecha', 'comprador', 'remito', 'total', 'cobrada'] },
  { nombre: 'facturas', model: Invoice, campos: ['numero', 'emitidaEn', 'vencimiento', 'cliente', 'total', 'estado'] },
];

const escapeCsv = (v) => {
  if (v == null) return '';
  const s = v instanceof Date ? v.toISOString() : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function colAsCsv({ model, campos }) {
  const docs = await model.find({}).lean();
  const header = campos.join(',');
  const filas = docs.map((d) => campos.map((c) => escapeCsv(d[c])).join(','));
  return [header, ...filas].join('\n');
}

export const exportarRouter = Router();
exportarRouter.use(requireRole('administracion'));

exportarRouter.get('/datos.zip', async (_req, res) => {
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="datos-${new Date().toISOString().slice(0, 10)}.zip"`);
  const zip = archiver('zip', { zlib: { level: 9 } });
  zip.pipe(res);
  for (const col of COLECCIONES) {
    const csv = await colAsCsv(col);
    zip.append(csv, { name: `${col.nombre}.csv` });
  }
  zip.append(
    `Export generado el ${new Date().toISOString()}\n\n` +
      'Este archivo contiene los datos de tu organización en Gestión RSU.\n' +
      'Las fechas están en formato ISO 8601. Los IDs son referencias internas.\n',
    { name: 'README.txt' },
  );
  await zip.finalize();
});
