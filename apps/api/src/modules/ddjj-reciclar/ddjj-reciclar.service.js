// Generador de DDJJ Reciclar — RG ARCA 2849/2010.
// Cruza compras de materiales a recuperadores/proveedores y ventas a industria
// para armar el detalle que se informa mensualmente ante ARCA.
import { Intake, Sale } from '../plant/plant.models.js';
import { Material } from '../materials/material.model.js';
import { Client } from '../clients/client.model.js';
import { Recuperador } from '../recuperadores/recuperadores.js';
import { Comprobante } from '../afip/comprobante.model.js';
import { Organization } from '../organizations/organization.model.js';
import { currentTenant } from '../../lib/tenancy.js';

const kg2 = (n) => Math.round((n ?? 0) * 100) / 100;

export async function generarDDJJReciclar({ anio, mes }) {
  if (!anio || !mes || mes < 1 || mes > 12) throw new Error('Período inválido');
  const desde = new Date(Date.UTC(anio, mes - 1, 1));
  const hasta = new Date(Date.UTC(anio, mes, 1));

  const org = await Organization.findById(currentTenant()).lean();
  const mats = await Material.find().lean();
  const porMatId = new Map(mats.map((m) => [String(m._id), m]));

  // --- COMPRAS (ingresos a planta) ---
  const ingresos = await Intake.find({ fecha: { $gte: desde, $lt: hasta } }).populate('proveedor').lean();
  const compras = [];
  for (const ing of ingresos) {
    for (const it of ing.items) {
      const mat = porMatId.get(String(it.material));
      if (!mat) continue;
      compras.push({
        fecha: ing.fecha,
        proveedor: ing.proveedor?.razonSocial || ing.origen || 'Sin identificar',
        cuitProveedor: ing.proveedor?.cuit || null,
        material: mat.nombre,
        codigoMaterial: mat.codigo,
        pesoKg: kg2(it.pesoKg),
        comprobante: ing.comprobante || null,
      });
    }
  }

  // --- VENTAS ---
  const ventas = await Sale.find({ fecha: { $gte: desde, $lt: hasta } }).populate('comprador').lean();
  const ventasDetalle = [];
  for (const v of ventas) {
    for (const it of v.items) {
      const mat = porMatId.get(String(it.material));
      if (!mat) continue;
      ventasDetalle.push({
        fecha: v.fecha,
        comprador: v.comprador?.razonSocial || 'Sin identificar',
        cuitComprador: v.comprador?.cuit || null,
        material: mat.nombre,
        codigoMaterial: mat.codigo,
        pesoKg: kg2(it.pesoKg),
        precioUnitario: kg2(it.precioUnitario),
        subtotal: kg2((it.pesoKg || 0) * (it.precioUnitario || 0)),
      });
    }
  }

  // --- COMPROBANTES FISCALES del período ---
  const comprobantes = await Comprobante.find({ fecha: { $gte: desde, $lt: hasta } }).lean().catch(() => []);

  // --- TOTALES ---
  const totalComprasKg = compras.reduce((a, c) => a + c.pesoKg, 0);
  const totalVentasKg = ventasDetalle.reduce((a, v) => a + v.pesoKg, 0);
  const totalVentasArs = ventasDetalle.reduce((a, v) => a + v.subtotal, 0);

  // Resumen por material
  const porMaterial = {};
  for (const c of compras) {
    const k = c.codigoMaterial || c.material;
    porMaterial[k] ??= { material: c.material, comprasKg: 0, ventasKg: 0, ventasArs: 0 };
    porMaterial[k].comprasKg += c.pesoKg;
  }
  for (const v of ventasDetalle) {
    const k = v.codigoMaterial || v.material;
    porMaterial[k] ??= { material: v.material, comprasKg: 0, ventasKg: 0, ventasArs: 0 };
    porMaterial[k].ventasKg += v.pesoKg;
    porMaterial[k].ventasArs += v.subtotal;
  }

  return {
    periodo: { anio, mes, desde, hasta },
    organizacion: { nombre: org.nombre, cuit: org.cuit, domicilio: org.domicilio },
    compras,
    ventas: ventasDetalle,
    comprobantesEmitidos: comprobantes.length,
    totales: {
      comprasKg: kg2(totalComprasKg),
      ventasKg: kg2(totalVentasKg),
      ventasArs: kg2(totalVentasArs),
      operaciones: compras.length + ventasDetalle.length,
    },
    porMaterial: Object.values(porMaterial).map((m) => ({
      ...m,
      comprasKg: kg2(m.comprasKg),
      ventasKg: kg2(m.ventasKg),
      ventasArs: kg2(m.ventasArs),
    })),
  };
}
