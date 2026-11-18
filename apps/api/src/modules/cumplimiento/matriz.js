// Matriz de cumplimiento: ítems de las 5 áreas (registral, documental, operativa, laboral, fiscal)
// armados a partir del perfil, la jurisdicción y las corrientes de tratamiento. Los ítems "auto"
// se calculan de los registros del sistema (remitos, ingresos, personal, seguridad); los "manuales"
// se cumplen con una evidencia (archivo, número o marca). Portado de la página.
import { PROV, MUNI, REG_PROV, OBL_MUNI, T_PEL, AREAS } from '@nueva-vida/catalogos';
import { Remito } from '../proceso/proceso.models.js';
import { Movimiento } from '../movimientos/movimiento.model.js';
import { RegistroServicio } from '../registros/registro.model.js';
import { Convenio } from '../comercial/comercial.models.js';
import { round2 } from '../../lib/validation.js';

/** Áreas de la matriz, con sus etiquetas (orden fijo). */
export const AREAS_MAP = Object.fromEntries(AREAS);

const nombreProv = (p) => PROV[p]?.[0] ?? 'tu provincia';
const muniDatos = (jur) => (jur?.provincia && jur.municipio && MUNI[jur.provincia]?.[jur.municipio]) || null;
const normaMuni = (jur) => {
  const m = muniDatos(jur);
  if (!m) return 'Ordenanza local';
  const conf = m.normas.find((x) => x[2] === 1)?.[0];
  return conf ?? 'Ordenanza local';
};

/** Contexto: qué corrientes trata la organización, qué muni, qué provincia. */
function contexto(org, corrientes = []) {
  const t = corrientes;
  return {
    t,
    perfil: org.perfil ?? (org.tipo === 'recicladora' ? 'empresa' : 'cooperativa'),
    jur: org.jurisdiccion ?? {},
    pel: t.some((x) => T_PEL.includes(x)),
    fito: t.includes('fito_a') || t.includes('fito_b'),
    coop: (org.perfil ?? org.tipo) === 'cooperativa',
  };
}

const M = (area, id, titulo, norma, porque, { vence = true, origen = null } = {}) => ({ area, id, titulo, norma, porque, tipo: 'manual', vence, origen });
const A = (area, id, titulo, norma, porque, check) => ({ area, id, titulo, norma, porque, tipo: 'auto', check });

/** Ítems de la matriz según perfil, jurisdicción y corrientes. No consulta la base. */
export function itemsMatriz(org, corrientes = []) {
  if ((org.perfil ?? org.tipo) === 'municipio') return [];
  const c = contexto(org, corrientes);
  const prov = nombreProv(c.jur.provincia);
  const muniN = muniDatos(c.jur)?.n.replace(/ \(.*\)$/, '') ?? 'tu municipio';
  const muniNorma = normaMuni(c.jur);
  const regP = REG_PROV[c.jur.provincia] ?? ['Registro provincial de operadores', `Autoridad ambiental de ${prov}`];
  const l = [];

  // 1. Registral y habilitación ambiental
  l.push(M('reg', 'ambiental', 'Certificado de Aptitud Ambiental o habilitación provincial', `Autoridad ambiental de ${prov}`, 'Sin él no se pueden recibir ni tratar residuos de terceros.'));
  l.push(M('reg', 'eia', 'Estudio de Impacto Ambiental y memoria descriptiva', `Autoridad ambiental de ${prov}`, 'Se presenta para obtener el certificado de aptitud ambiental.', { vence: false }));
  l.push(M('reg', 'registro', regP[0], regP[1], 'Para recibir residuos secos de grandes generadores.'));
  if (c.pel) {
    l.push(M('reg', 'reg_pel', 'Registro de Operadores de Residuos Peligrosos y Certificado Ambiental Anual', 'Ley 24.051', 'Tratás corrientes peligrosas o con fracciones peligrosas.'));
    l.push(M('reg', 'taa', 'Tasa Ambiental Anual pagada', 'Ley 24.051', 'Acompaña al Certificado Ambiental Anual.'));
  }
  if (c.fito) l.push(M('reg', 'campolimpio', 'Habilitación como operador CampoLimpio', 'Ley 27.279', 'Tratás envases vacíos de fitosanitarios.'));
  l.push(M('reg', 'hab_mun', `Habilitación municipal y radicación (${muniN})`, muniNorma, 'La zona tiene que ser apta para acopio o industria.'));
  l.push(M('reg', 'bomberos', 'Certificado final de Bomberos (plan de evacuación y carga de fuego)', 'Normas provinciales y municipales', 'Los fardos de papel, cartón y plásticos tienen alto riesgo de incendio.'));
  l.push(M('reg', 'transporte', 'Habilitación del vehículo de carga', 'Municipio o provincia', 'Tiene que figurar en cada remito o manifiesto.'));
  if (c.coop) {
    l.push(A('reg', 'conv_mun', 'Convenio con el municipio vigente', muniNorma, 'Encuadra el servicio de la cooperativa con el municipio.', async () => {
      const cv = await Convenio.findOne({ activo: true }).lean();
      if (!cv) return { ok: null, txt: 'Sin convenio cargado' };
      if (cv.hasta && new Date(cv.hasta) < new Date()) return { ok: false, txt: `Venció el ${new Date(cv.hasta).toLocaleDateString('es-AR')}` };
      return { ok: true, txt: `${cv.nombre}${cv.hasta ? `, hasta ${new Date(cv.hasta).toLocaleDateString('es-AR')}` : ''}` };
    }));
  }
  const m = muniDatos(c.jur);
  if (m) {
    for (const tema of m.temas) {
      const d = OBL_MUNI[tema];
      const v = d && (d[c.perfil === 'municipio' ? 'municipio' : 'planta'] ?? d.todos);
      if (v) l.push(M('reg', `mu-${tema}`, v[0], `${m.n}`, v[1], { vence: false }));
    }
  }

  // 2. Documental y trazabilidad
  if (c.pel) l.push(M('doc', 'simel', 'Manifiestos en SIMEL para corrientes peligrosas', 'Ley 24.051', 'Cada traslado lleva manifiesto electrónico.', { vence: false }));
  l.push(A('doc', 'remitos', 'Remitos numerados y correlativos', 'Cadena de custodia', 'Con datos del generador, del transportista y del receptor.', async () => {
    const r = await Remito.find({ anulado: false }).sort('numero').select('numero').lean();
    if (!r.length) return { ok: null, txt: 'Todavía no hay remitos' };
    const huecos = r.some((x, i) => i && x.numero !== r[i - 1].numero + 1);
    return huecos ? { ok: false, txt: 'Hay saltos en la numeración' } : { ok: true, txt: `${r.length} ${r.length === 1 ? 'remito' : 'remitos'}, numeración correlativa` };
  }));
  l.push(M('doc', 'bascula', 'Certificado de calibración de la báscula vigente', 'Auditorías ISO 14001', 'Respalda el peso de cada ingreso y egreso.'));
  l.push(A('doc', 'balance', 'Libro de operaciones y balance de masa', 'Ingresado = vendido + rechazo + stock + merma', 'Demuestra que todo lo que entra tiene un destino.', async () => {
    const [ing, ven, rech] = await Promise.all([
      Movimiento.aggregate([{ $match: { tipo: 'ingreso' } }, { $group: { _id: null, kg: { $sum: '$kg' } } }]),
      Movimiento.aggregate([{ $match: { tipo: 'venta' } }, { $group: { _id: null, kg: { $sum: { $abs: '$kg' } } } }]),
      Movimiento.aggregate([{ $match: { tipo: 'rechazo' } }, { $group: { _id: null, kg: { $sum: { $abs: '$kg' } } } }]),
    ]);
    const ingKg = ing[0]?.kg ?? 0;
    if (!ingKg) return { ok: null, txt: 'Sin ingresos registrados' };
    const vendRech = (ven[0]?.kg ?? 0) + (rech[0]?.kg ?? 0);
    const balance = Math.abs(ingKg - vendRech) / ingKg;
    return { ok: balance <= 0.1 || vendRech <= ingKg, txt: `Ingresado ${round2(ingKg)} kg, con destino ${round2(vendRech)} kg` };
  }));

  // 3. Operativa, sanitaria y técnica
  l.push(M('ope', 'segregacion', 'Segregación por material en bateas o jaulas rotuladas', 'Buenas prácticas ISWA', 'Evita contaminación cruzada y mejora la venta.', { vence: false }));
  l.push(M('ope', 'incendios', 'Red contra incendios y detección de humo', 'Reglamentación provincial de incendios', 'Carga de fuego alta por papel, cartón y plásticos.'));
  if (c.pel) l.push(M('ope', 'contencion', 'Bateas de contención con doble pared para residuos peligrosos', 'Ley 24.051', 'Evita derrames de líquidos y sólidos peligrosos.', { vence: false }));
  l.push(A('ope', 'rutinas', 'Rutinas diarias, semanales y mensuales registradas', 'Guía ISWA / productividad', 'Se marcan quién y cuándo las hizo en Operación → Rutinas.', async () => {
    const { tareasPendientes } = await import('../proceso/rutinas.js');
    const pend = await tareasPendientes();
    return pend.length === 0 ? { ok: true, txt: 'Todas al día' } : { ok: false, txt: `${pend.length} ${pend.length === 1 ? 'tarea pendiente' : 'tareas pendientes'}` };
  }));

  // 4. Societaria, laboral y seguridad
  if (c.coop) l.push(M('lab', 'inaes', 'Inscripción en INAES con autoridades vigentes', 'Ley 20.337', 'Balances y padrón de asociados al día.'));
  else l.push(M('lab', 'societario', 'Inscripción societaria vigente', 'Ley 19.550 u otras', 'Estatuto y autoridades actualizados.'));
  l.push(M('lab', 'art', 'ART y aportes patronales al día', 'Ley 24.557', 'Cobertura del personal.'));
  l.push(M('lab', 'hys', 'Servicio de Higiene y Seguridad (profesional matriculado)', 'Ley 19.587', 'Avala las capacitaciones y la evaluación de riesgos.'));
  l.push(A('lab', 'epp', 'Entrega de elementos de protección con planilla firmada', 'Ley 19.587', 'Guantes, calzado, fajas, protección ocular y auditiva.', async () => {
    const anio = new Date().getFullYear();
    const n = await RegistroServicio.countDocuments({ registro: 'epp', fecha: { $gte: new Date(anio, 0, 1) } });
    return n ? { ok: true, txt: `${n} entregas registradas en ${anio}` } : { ok: false, txt: `Sin entregas registradas en ${anio}` };
  }));
  l.push(A('lab', 'capacit', 'Capacitaciones en cargas, incendios y sustancias peligrosas', 'Ley 19.587', 'Avaladas por un profesional de Higiene y Seguridad.', async () => {
    const anio = new Date().getFullYear();
    const n = await RegistroServicio.countDocuments({ registro: 'capacitaciones', fecha: { $gte: new Date(anio, 0, 1) } });
    return n ? { ok: true, txt: `${n} capacitaciones en ${anio}` } : { ok: false, txt: `Sin capacitaciones registradas en ${anio}` };
  }));

  // 5. Fiscal y comercial
  l.push(M('fis', 'arca', 'Inscripción en ARCA y facturación electrónica', 'ARCA (ex AFIP)', 'Por el retiro cobrado a grandes generadores y la venta de material.', { vence: false }));
  l.push(M('fis', 'iibb', `Ingresos Brutos y tasa de seguridad e higiene`, `${prov} y ${muniN}`, 'Inscripción provincial y tasa municipal.', { vence: false }));
  if (!c.coop || c.t.includes('metales')) {
    l.push(M('fis', 'compras_resp', 'Respaldo de cada compra a recuperadores o acopiadores', 'Origen lícito del material', 'Evita contingencias por material de procedencia ilícita.', { vence: false }));
  }

  return l;
}

/** Resumen por área: cuántos cumplen, total y porcentaje. */
export function resumenPorArea(items) {
  return AREAS.map(([id, label]) => {
    const en = items.filter((x) => x.area === id);
    const ok = en.filter((x) => x.estado?.codigo === 'cumple').length;
    return { area: id, label, ok, total: en.length, pct: en.length ? round2((ok / en.length) * 100) : null };
  });
}
