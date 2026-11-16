// Indicadores de productividad de la planta, según la Guía de productividad para plantas de
// valorización de residuos (procesamiento, personal y comercialización). El objetivo de la
// guía: que crezca lo que cobra cada trabajador por la venta del material.
//
// Salen del libro de movimientos y de las ventas cuando los datos ya se registran; el resto
// (personal del mes, paradas de máquina, accidentes) se carga en esta misma sección.
import { Router } from 'express';
import { z } from 'zod';
import { Movimiento } from '../movimientos/movimiento.model.js';
import { Material } from '../materials/material.model.js';
import { Sale } from '../plant/plant.models.js';
import { Organization } from '../organizations/organization.model.js';
import { RegistroSeguridad } from '../seguridad/seguridad.js';
import { PersonalMes, ParadaMaquina, personalInput, paradaInput, mesInput, MAQUINAS } from './productividad.models.js';
import { requireRole } from '../../middleware/auth.js';
import { HttpError } from '../../middleware/error.js';
import { currentTenant } from '../../lib/tenancy.js';
import { parseLocalDate, endOfLocalDay, round2 } from '../../lib/validation.js';

export const productividadRouter = Router();

const mesActual = () => {
  const d = new Date(Date.now() + -3 * 3600_000); // hora argentina
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};
function rangoMes(mes) {
  const [y, m] = mes.split('-').map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { desde: parseLocalDate(`${mes}-01`), hasta: endOfLocalDay(`${mes}-${String(ultimo).padStart(2, '0')}`) };
}
function mesesAntes(mes, n) {
  const [y, m] = mes.split('-').map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}
const div = (a, b) => (a == null || b == null || b === 0 ? null : round2(a / b));
const pct = (a, b) => (div(a, b) == null ? null : round2((a / b) * 100));
const tn = (kg) => round2(kg / 1000);

/** Datos de operación del mes que salen de los registros de la plataforma. */
async function datosDelMes(mes) {
  const { desde, hasta } = rangoMes(mes);
  const fecha = { $gte: desde, $lte: hasta };
  const noSeparables = new Set((await Material.find({ $or: [{ mezcla: true }, { fraccion: 'basura' }] }).select('_id')).map((m) => String(m._id)));

  const movs = await Movimiento.find({ fecha, tipo: { $in: ['ingreso', 'clasificacion', 'rechazo'] } }).select('tipo material kg');
  let ingresadoKg = 0;
  let separadoKg = 0;
  let rechazoKg = 0;
  const tiposSeparados = new Set();
  for (const m of movs) {
    const id = String(m.material);
    if (m.tipo === 'ingreso') ingresadoKg += m.kg;
    if (m.tipo === 'rechazo') rechazoKg += Math.abs(m.kg);
    // Separado y acopiado: lo que entra ya clasificado por material y lo que sale de clasificar la mezcla
    if ((m.tipo === 'ingreso' || m.tipo === 'clasificacion') && m.kg > 0 && !noSeparables.has(id)) {
      separadoKg += m.kg;
      tiposSeparados.add(id);
    }
  }

  const ventas = await Sale.find({ fecha });
  const tiposVendidos = new Set(ventas.flatMap((v) => v.items.map((i) => String(i.material))));
  const vendidoKg = ventas.reduce((a, v) => a + v.items.reduce((b, i) => b + i.pesoKg, 0), 0);
  const facturado = ventas.reduce((a, v) => a + (v.total ?? 0), 0);

  const paradas = await ParadaMaquina.find({ fecha });
  const horasParada = Object.fromEntries(Object.keys(MAQUINAS).map((k) => [k, round2(paradas.filter((p) => p.maquina === k).reduce((a, p) => a + p.horas, 0))]));
  const accidentes = await RegistroSeguridad.find({ fecha, tipo: 'accidente' });

  return {
    ingresadoTn: tn(ingresadoKg),
    separadoTn: tn(separadoKg),
    rechazoTn: tn(rechazoKg),
    vendidoTn: tn(vendidoKg),
    facturado: round2(facturado),
    tiposSeparados: tiposSeparados.size,
    tiposVendidos: tiposVendidos.size,
    horasParada,
    accidentes: accidentes.length,
    diasPerdidosAccidentes: accidentes.reduce((a, x) => a + (x.diasPerdidos ?? 0), 0),
  };
}

/** Indicadores de la guía, con la fórmula y qué dato falta cuando no se puede calcular. */
function indicadores(d, personal, planta, bajasAnio) {
  const p = personal ?? {};
  const ind = (grupo, clave, nombre, formula, valor, unidad, falta, fuente) => ({ grupo, clave, nombre, formula, valor, unidad, falta: valor == null ? falta : null, fuente });
  return [
    ind('procesamiento', 'productividad', 'Nivel de productividad', 't separadas y acopiadas / persona / mes', div(d.separadoTn, p.personas), 't', 'Cargá cuántas personas trabajaron en el mes', 'automatico'),
    ind('procesamiento', 'utilizacion', 'Utilización de la planta', 't ingresadas / capacidad instalada', pct(d.ingresadoTn, planta?.capacidadTnMes), '%', 'Cargá la capacidad instalada de la planta', 'automatico'),
    ind('procesamiento', 'rechazo', 'Porcentaje de rechazo', 't rechazadas / t ingresadas', pct(d.rechazoTn, d.ingresadoTn), '%', 'No hubo ingresos en el mes', 'automatico'),
    ind('procesamiento', 'cinta_parada', 'Horas de cinta parada', 'horas de cinta parada / horas trabajables del mes', pct(d.horasParada.cinta, planta?.horasTrabajablesMes), '%', 'Cargá las horas trabajables del mes', 'se_carga'),
    ind('personal', 'ingresos', 'Nivel de ingresos', 'ingreso promedio / salario mínimo, vital y móvil', div(p.ingresoPromedio, p.smvm), 'SMVM', 'Cargá el ingreso promedio y el SMVM del mes', 'se_carga'),
    ind('personal', 'formalizacion', 'Formalización', 'personas formalizadas / total', pct(p.formalizadas, p.personas), '%', 'Cargá cuántas personas están formalizadas', 'se_carga'),
    ind('personal', 'ausentismo', 'Ausentismo', 'días perdidos por ausentismo / días trabajados', pct(p.diasAusencia, p.diasTrabajados), '%', 'Cargá los días trabajados y los perdidos', 'se_carga'),
    ind('personal', 'accidentes', 'Accidentes', 'días perdidos por accidentes / días trabajados', pct(d.diasPerdidosAccidentes, p.diasTrabajados), '%', 'Cargá los días trabajados del mes', 'se_carga'),
    ind('personal', 'rotacion', 'Rotación anual', 'personas que se fueron en 12 meses / total', pct(bajasAnio, p.personas), '%', 'Cargá el personal del mes', 'se_carga'),
    ind('comercializacion', 'eficiencia_venta', 'Eficiencia de venta', 'tipos de material vendidos / tipos separados', pct(d.tiposVendidos, d.tiposSeparados), '%', 'No hubo material separado en el mes', 'automatico'),
    ind('comercializacion', 'precio_promedio', 'Precio promedio', 'total facturado / kg vendidos', d.vendidoTn ? round2(d.facturado / (d.vendidoTn * 1000)) : null, '$/kg', 'No hubo ventas en el mes', 'automatico'),
  ];
}

productividadRouter.get('/', requireRole('administracion', 'operador_planta'), async (req, res) => {
  const mes = mesInput.default(mesActual()).parse(req.query.mes);
  const org = await Organization.findById(currentTenant()).select('planta');
  const planta = org?.planta ?? {};
  const [d, personal, ultimos12] = await Promise.all([datosDelMes(mes), PersonalMes.findOne({ mes }), PersonalMes.find({ mes: { $in: mesesAntes(mes, 12) } })]);
  const bajasAnio = personal ? ultimos12.reduce((a, p) => a + (p.bajas ?? 0), 0) : null;

  // Evolución de los últimos 6 meses: índice de productividad y rechazo
  const meses = mesesAntes(mes, 6);
  const personalPorMes = new Map(ultimos12.map((p) => [p.mes, p]));
  const evolucion = [];
  for (const m of meses) {
    const dm = m === mes ? d : await datosDelMes(m);
    const pm = personalPorMes.get(m);
    evolucion.push({ mes: m, indiceProductividad: div(dm.vendidoTn, pm?.personas), vendidoTn: dm.vendidoTn, rechazo: pct(dm.rechazoTn, dm.ingresadoTn), personas: pm?.personas ?? null });
  }

  res.json({
    mes,
    planta,
    datos: d,
    personal,
    // Índice de productividad de la guía: toneladas VENDIDAS por persona en el mes
    indiceProductividad: div(d.vendidoTn, personal?.personas),
    indicadores: indicadores(d, personal, planta, bajasAnio),
    evolucion,
  });
});

// Datos fijos de la planta: capacidad instalada y horas trabajables por mes
productividadRouter.patch('/planta', requireRole(), async (req, res) => {
  const data = z.object({ capacidadTnMes: z.number().positive().max(100000).optional(), horasTrabajablesMes: z.number().positive().max(744).optional() }).parse(req.body);
  const org = await Organization.findById(currentTenant());
  for (const [k, v] of Object.entries(data)) org.set(`planta.${k}`, v);
  await org.save();
  res.json({ planta: org.planta });
});

// Personal del mes (se reemplaza si ya estaba cargado)
productividadRouter.put('/personal/:mes', requireRole('administracion'), async (req, res) => {
  const mes = mesInput.parse(req.params.mes);
  const data = personalInput.parse(req.body);
  const doc = (await PersonalMes.findOne({ mes })) ?? new PersonalMes({ mes });
  doc.set(data);
  await doc.save();
  res.json(doc);
});

// Paradas de máquina
productividadRouter.get('/paradas', requireRole('administracion', 'operador_planta'), async (req, res) => {
  const mes = mesInput.default(mesActual()).parse(req.query.mes);
  const { desde, hasta } = rangoMes(mes);
  res.json({ items: await ParadaMaquina.find({ fecha: { $gte: desde, $lte: hasta } }).sort('-fecha') });
});
productividadRouter.post('/paradas', requireRole('administracion', 'operador_planta'), async (req, res) => {
  res.status(201).json(await ParadaMaquina.create(paradaInput.parse(req.body)));
});
productividadRouter.delete('/paradas/:id', requireRole('administracion', 'operador_planta'), async (req, res) => {
  const p = await ParadaMaquina.findByIdAndDelete(req.params.id);
  if (!p) throw new HttpError(404, 'Parada no encontrada');
  res.status(204).end();
});
