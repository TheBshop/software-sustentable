// Reporte mensual estilo SNIGEI (Sistema Nacional de Información de Gestión Integral de RSU).
// Agrega los ingresos a planta del mes por corriente, fracción, tratamiento y categoría,
// y los cruza contra ventas y rechazos para dejar el "a disposición final" calculado.
// Formato final a verificar con el formulario oficial vigente del organismo nacional.
import { Intake, Sale } from '../plant/plant.models.js';
import { Material } from '../materials/material.model.js';

const kg = (n) => Math.round((n ?? 0) * 100) / 100;
const tn = (n) => Math.round(((n ?? 0) / 1000) * 1000) / 1000;

export async function reporteMensual({ anio, mes }) {
  if (!anio || !mes || mes < 1 || mes > 12) throw new Error('Período inválido');
  const desde = new Date(Date.UTC(anio, mes - 1, 1));
  const hasta = new Date(Date.UTC(anio, mes, 1));

  const mats = await Material.find().lean();
  const porId = new Map(mats.map((m) => [String(m._id), m]));

  const ingresos = await Intake.find({ fecha: { $gte: desde, $lt: hasta } }).lean();
  const ventas = await Sale.find({ fecha: { $gte: desde, $lt: hasta } }).lean();

  const porCorriente = {}; // corriente → kg ingresados
  const porFraccion = {};
  const porTratamiento = {};
  const porCategoria = {};
  const porMaterial = new Map(); // id → { nombre, codigo, ingresoKg, ventaKg }

  for (const i of ingresos) {
    for (const it of i.items) {
      const m = porId.get(String(it.material));
      if (!m) continue;
      const k = it.pesoKg || 0;
      porCorriente[m.corriente || 'rsu'] = (porCorriente[m.corriente || 'rsu'] || 0) + k;
      if (m.fraccion) porFraccion[m.fraccion] = (porFraccion[m.fraccion] || 0) + k;
      if (m.tratamiento) porTratamiento[m.tratamiento] = (porTratamiento[m.tratamiento] || 0) + k;
      if (m.categoria) porCategoria[m.categoria] = (porCategoria[m.categoria] || 0) + k;
      const curr = porMaterial.get(String(m._id)) || { nombre: m.nombre, codigo: m.codigo, corriente: m.corriente, categoria: m.categoria, fraccion: m.fraccion, tratamiento: m.tratamiento, ingresoKg: 0, ventaKg: 0 };
      curr.ingresoKg += k;
      porMaterial.set(String(m._id), curr);
    }
  }
  for (const v of ventas) {
    for (const it of v.items) {
      const m = porId.get(String(it.material));
      if (!m) continue;
      const curr = porMaterial.get(String(m._id)) || { nombre: m.nombre, codigo: m.codigo, corriente: m.corriente, categoria: m.categoria, fraccion: m.fraccion, tratamiento: m.tratamiento, ingresoKg: 0, ventaKg: 0 };
      curr.ventaKg += it.pesoKg || 0;
      porMaterial.set(String(m._id), curr);
    }
  }

  const totalIngresoKg = Object.values(porCorriente).reduce((a, b) => a + b, 0);
  const totalVentaKg = ventas.reduce((a, v) => a + v.items.reduce((s, i) => s + (i.pesoKg || 0), 0), 0);
  const disposicionFinalKg = porTratamiento['disposicion_final'] || 0;
  const recuperadoKg = totalIngresoKg - disposicionFinalKg;
  const tasaRecuperacion = totalIngresoKg ? Math.round((recuperadoKg / totalIngresoKg) * 1000) / 10 : 0;

  return {
    periodo: { anio, mes, desde, hasta },
    totales: {
      ingresoKg: kg(totalIngresoKg),
      ingresoTn: tn(totalIngresoKg),
      ventaKg: kg(totalVentaKg),
      disposicionFinalKg: kg(disposicionFinalKg),
      recuperadoKg: kg(recuperadoKg),
      tasaRecuperacionPct: tasaRecuperacion,
    },
    porCorriente: mapKg(porCorriente),
    porFraccion: mapKg(porFraccion),
    porTratamiento: mapKg(porTratamiento),
    porCategoria: mapKg(porCategoria),
    porMaterial: [...porMaterial.values()].map((m) => ({ ...m, ingresoKg: kg(m.ingresoKg), ventaKg: kg(m.ventaKg) })),
  };
}

function mapKg(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, kg(v)]));
}
