// Importador de datos desde Odoo vía CSV (res.partner, product.product, account.move).
// Mapeo flexible: acepta variantes de nombres de columnas comunes.
// Idempotente: upsert por CUIT, por código o por número.
import { Client } from '../clients/client.model.js';
import { Material } from '../materials/material.model.js';
import { CORRIENTES } from '../organizations/organization.model.js';
import { Invoice } from '../invoices/invoice.model.js';
import { parseCsv } from './csv.js';

const limpiarCuit = (v) => String(v ?? '').replace(/^AR/i, '').replace(/\D/g, '');
const num = (v) => {
  const n = Number(String(v ?? '').replace(/[^0-9.,-]/g, '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const tomar = (fila, ...claves) => { for (const k of claves) if (fila[k] != null && fila[k] !== '') return fila[k]; return ''; };
const log = (resumen, err) => { resumen.errores.push(err); };

/** res.partner → Client (generador/comprador/proveedor/ambos). */
export async function importarContactos(csvContent) {
  const filas = parseCsv(csvContent);
  const resumen = { creados: 0, actualizados: 0, errores: [] };
  for (const [i, f] of filas.entries()) {
    try {
      const razonSocial = tomar(f, 'name', 'Name', 'Nombre').trim();
      if (!razonSocial) { log(resumen, { fila: i + 2, msg: 'Fila sin nombre' }); continue; }
      const cuit = limpiarCuit(tomar(f, 'vat', 'VAT', 'CUIT', 'cuit'));
      const esCliente = ['1', 'true', 'True', 'TRUE'].includes(String(tomar(f, 'customer_rank', 'Customer Rank', 'customer', 'Customer'))) || num(tomar(f, 'customer_rank', 'Customer Rank')) > 0;
      const esProveedor = ['1', 'true', 'True', 'TRUE'].includes(String(tomar(f, 'supplier_rank', 'Supplier Rank', 'supplier'))) || num(tomar(f, 'supplier_rank', 'Supplier Rank')) > 0;
      const tipo = esCliente && esProveedor ? 'ambos' : esProveedor ? 'proveedor' : esCliente ? 'generador' : 'generador';
      const email = tomar(f, 'email', 'Email').toLowerCase().trim();
      const telefono = tomar(f, 'phone', 'Phone', 'Teléfono', 'telefono').trim();
      const direccion = [tomar(f, 'street', 'Street'), tomar(f, 'city', 'City')].filter(Boolean).join(', ');
      const rubro = tomar(f, 'category_id/name', 'category_id', 'Category', 'Rubro').trim();
      const externo = tomar(f, 'ref', 'Internal Reference', 'Reference').trim();
      const data = {
        razonSocial,
        tipo,
        ...(cuit && /^\d{11}$/.test(cuit) && { cuit }),
        ...(rubro && { rubro: externo ? `${rubro} (ref ${externo})` : rubro }),
        ...(!rubro && externo && { rubro: `ref ${externo}` }),
        contacto: { email: email || undefined, telefono: telefono || undefined },
        ...(direccion && { direcciones: [{ direccion }] }),
      };
      const filtro = cuit && /^\d{11}$/.test(cuit) ? { cuit } : { razonSocial };
      const existente = await Client.findOne(filtro);
      if (existente) {
        existente.set(data);
        await existente.save();
        resumen.actualizados += 1;
      } else {
        await Client.create(data);
        resumen.creados += 1;
      }
    } catch (e) { log(resumen, { fila: i + 2, msg: e.message }); }
  }
  return resumen;
}

/** product.product → Material. */
export async function importarProductos(csvContent) {
  const filas = parseCsv(csvContent);
  const resumen = { creados: 0, actualizados: 0, errores: [] };
  for (const [i, f] of filas.entries()) {
    try {
      const nombre = tomar(f, 'name', 'Name', 'Nombre').trim();
      if (!nombre) { log(resumen, { fila: i + 2, msg: 'Fila sin nombre' }); continue; }
      const codigo = tomar(f, 'default_code', 'Internal Reference', 'codigo', 'Código').trim() || nombre.replace(/\s+/g, '-').toUpperCase().slice(0, 30);
      const precioVentaKg = num(tomar(f, 'list_price', 'Sales Price', 'Precio', 'precio'));
      const categoriaRaw = tomar(f, 'categ_id/name', 'categ_id', 'Category').toLowerCase();
      const corriente = inferirCorriente(categoriaRaw, nombre);
      const categoria = inferirCategoria(categoriaRaw, nombre);
      const data = { nombre, codigo: codigo.trim(), categoria, corriente, ...(precioVentaKg > 0 && { precioVentaKg }) };
      const existente = await Material.findOne({ codigo: data.codigo });
      if (existente) { existente.set(data); await existente.save(); resumen.actualizados += 1; }
      else { await Material.create(data); resumen.creados += 1; }
    } catch (e) { log(resumen, { fila: i + 2, msg: e.message }); }
  }
  return resumen;
}

function inferirCategoria(cat, nombre) {
  const t = `${cat} ${nombre}`.toLowerCase();
  if (/papel|cart[óo]n|carton/.test(t)) return 'papel_carton';
  if (/pl[áa]stico|plastico|pet|hdpe|nylon|polietileno/.test(t)) return 'plasticos';
  if (/vidrio|cristal|botella/.test(t)) return 'vidrio';
  if (/metal|aluminio|hierro|cobre|bronce|chatarra/.test(t)) return 'metales';
  if (/electr[óo]nico|raee|notebook|celular|monitor|placa|cable/.test(t)) return 'electronicos';
  return 'otros';
}

function inferirCorriente(cat, nombre) {
  const t = `${cat} ${nombre}`.toLowerCase();
  if (/peligroso|t[óo]xico|solvente|aceite mineral/.test(t)) return 'peligroso';
  if (/raee|electr[óo]nico|bater[íi]a de litio|celular|notebook|pc\b|monitor|placa/.test(t)) return 'regu';
  if (/industrial/.test(t)) return 'industrial';
  if (/fitosanitario|envase.*agro/.test(t)) return 'fitosanitario';
  return 'rsu';
}

/** account.move → Invoice (al cliente). Idempotente por numero. */
export async function importarFacturas(csvContent) {
  const filas = parseCsv(csvContent);
  const resumen = { creados: 0, actualizados: 0, errores: [] };
  for (const [i, f] of filas.entries()) {
    try {
      const numeroRaw = tomar(f, 'name', 'Name', 'Número', 'numero').trim();
      const numero = Number(String(numeroRaw).replace(/\D/g, '')) || null;
      if (!numero) { log(resumen, { fila: i + 2, msg: 'Fila sin número' }); continue; }
      const fecha = new Date(tomar(f, 'invoice_date', 'Invoice Date', 'fecha', 'Fecha'));
      if (Number.isNaN(fecha.getTime())) { log(resumen, { fila: i + 2, msg: 'Fecha inválida' }); continue; }
      const cuit = limpiarCuit(tomar(f, 'partner_id/vat', 'Customer VAT', 'vat', 'CUIT'));
      const cliente = cuit && /^\d{11}$/.test(cuit) ? await Client.findOne({ cuit }) : null;
      const total = num(tomar(f, 'amount_total', 'Total', 'total'));
      const pagada = /paid|pagad/i.test(String(tomar(f, 'payment_state', 'Payment Status', 'estado')));
      if (!cliente) { log(resumen, { fila: i + 2, msg: `Cliente no encontrado (CUIT ${cuit || 's/d'})` }); continue; }
      const vencimiento = new Date(fecha.getTime() + 30 * 24 * 60 * 60 * 1000);
      const existente = await Invoice.findOne({ numero });
      const data = {
        numero,
        emitidaEn: fecha,
        vencimiento,
        cliente: cliente._id,
        clienteSnapshot: { razonSocial: cliente.razonSocial, cuit: cliente.cuit },
        total,
        estado: pagada ? 'pagada' : 'pendiente',
        ...(pagada && { pagos: [{ fecha, monto: total, medio: 'importado' }] }),
      };
      if (existente) { existente.set(data); await existente.save(); resumen.actualizados += 1; }
      else { await Invoice.create(data); resumen.creados += 1; }
    } catch (e) { log(resumen, { fila: i + 2, msg: e.message }); }
  }
  return resumen;
}

/** Corrientes conocidas (de organization.model.js). */
export const CORRIENTES_OK = CORRIENTES;
