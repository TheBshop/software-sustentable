// Clasificador de residuos en los tres niveles jurídicos (nación, provincia, municipio):
// régimen, operación R/D del Anexo III de la Ley 24.051 (códigos del Convenio de Basilea),
// gestión, documentos, si corresponde certificado verde y quién lo puede recibir.
// Ver docs/11-clasificacion-y-certificado-verde.md.
import { Router } from 'express';
import { z } from 'zod';
import { PROVINCIAS } from './jurisdicciones.js';
import { Organization } from '../organizations/organization.model.js';

export const ORIGENES = { vivienda: 'Vivienda', comercio: 'Comercio, oficina o institución', gran: 'Gran generador', industria: 'Industria o servicio', salud: 'Centro de salud', obra: 'Obra o demolición', campo: 'Campo', buque: 'Buque o puerto' };
export const CATEGORIAS = {
  seco: 'Seco reciclable', humedo: 'Húmedo / orgánico', rechazo: 'Rechazo no reciclable', industrial: 'Residuo de proceso industrial',
  raee: 'REGU · Aparato eléctrico o electrónico (RAEE)', nfu: 'REGU · Neumático fuera de uso', avu: 'REGU · Aceite vegetal usado', pilas: 'REGU · Pilas y baterías', lamparas: 'REGU · Lámparas y tubos fluorescentes',
  voluminoso: 'Voluminoso doméstico', poda: 'Poda y jardinería', arido: 'Áridos, escombros y restos de obra',
  patogenico: 'Patogénico (infeccioso)', fito_a: 'Envase de fitosanitario lavable (Tipo A)', fito_b: 'Envase de fitosanitario no lavable (Tipo B)', pcb: 'Con PCB (más de 50 ppm)', radiactivo: 'Radiactivo', buque: 'De buque (MARPOL)',
};
export const CARACTERISTICAS_H = { H1: 'Explosivo', H3: 'Líquido inflamable', 'H4.1': 'Sólido inflamable', 'H4.2': 'Combustión espontánea', 'H4.3': 'Gases inflamables con agua', 'H5.1': 'Oxidante', 'H5.2': 'Peróxido orgánico', 'H6.1': 'Tóxico agudo', 'H6.2': 'Infeccioso', H8: 'Corrosivo', H10: 'Gases tóxicos con aire o agua', H11: 'Tóxico crónico', H12: 'Ecotóxico', H13: 'Genera otra sustancia peligrosa' };
export const CORRIENTES_Y = { Y1: 'Desechos clínicos', Y3: 'Medicamentos', Y8: 'Aceites minerales', Y9: 'Mezclas aceite-agua', Y12: 'Tintas, pinturas, barnices', Y29: 'Mercurio', Y31: 'Plomo', Y34: 'Soluciones ácidas', Y42: 'Solventes orgánicos' };

// [nombre, origen, categoría, códigos H, corriente Y, riesgo industrial]
export const CATALOGO = [
  ['Cartón y papel', 'vivienda', 'seco'], ['Botella de PET', 'vivienda', 'seco'], ['Bidón de lavandina (PEAD)', 'vivienda', 'seco'], ['Bolsas y film', 'vivienda', 'seco'], ['Lata de aluminio', 'vivienda', 'seco'], ['Frasco de vidrio limpio', 'vivienda', 'seco'], ['Envase Tetra Pak', 'vivienda', 'seco'],
  ['Restos de comida, yerba, café', 'vivienda', 'humedo'], ['Servilletas sucias', 'vivienda', 'humedo'],
  ['Pañales y apósitos', 'vivienda', 'rechazo'], ['Colillas de cigarrillo', 'vivienda', 'rechazo'], ['Cerámica rota o espejo', 'vivienda', 'rechazo'],
  ['Cartón de un supermercado', 'gran', 'seco'], ['Residuos secos de oficinas', 'comercio', 'seco'],
  ['Scrap plástico de inyección', 'industria', 'industrial', [], '', 'bajo'], ['Viruta metálica limpia', 'industria', 'industrial', [], '', 'bajo'], ['Barros de una planta de efluentes', 'industria', 'industrial', [], '', 'medio'],
  ['Aceite de cocina usado', 'comercio', 'avu'], ['Celular, notebook, televisor', 'vivienda', 'raee'], ['Heladera o lavarropas', 'vivienda', 'raee'], ['Neumático usado', 'comercio', 'nfu'], ['Pilas', 'vivienda', 'pilas'], ['Batería de auto (ácido-plomo)', 'comercio', 'pilas', ['H8'], 'Y31'], ['Tubo fluorescente', 'comercio', 'lamparas', ['H11'], 'Y29'],
  ['Aceite de motor usado', 'industria', 'industrial', ['H3', 'H12'], 'Y8'], ['Envase de pintura con restos', 'industria', 'industrial', ['H3'], 'Y12'], ['Solvente usado', 'industria', 'industrial', ['H3', 'H6.1'], 'Y42'],
  ['Medicamentos vencidos (de un hogar)', 'vivienda', 'rechazo', ['H6.1'], 'Y3'], ['Aerosoles con restos', 'vivienda', 'rechazo', ['H3'], ''],
  ['Jeringas y agujas', 'salud', 'patogenico'], ['Gasas con sangre', 'salud', 'patogenico'], ['Residuos comunes de un sanatorio', 'salud', 'seco'],
  ['Bidón de agroquímico con triple lavado', 'campo', 'fito_a'], ['Bolsa de agroquímico en polvo', 'campo', 'fito_b'],
  ['Transformador con PCB', 'industria', 'pcb'], ['Fuente radiactiva en desuso', 'industria', 'radiactivo'], ['Sentinas de un buque', 'buque', 'buque'],
  ['Escombros y restos de obra', 'obra', 'arido'], ['Ramas y restos de poda', 'vivienda', 'poda'], ['Colchón o muebles viejos', 'vivienda', 'voluminoso'],
].map(([nombre, origen, cat, h = [], y = '', riesgo = 'bajo'], i) => ({ id: i, nombre, origen, cat, h, y, riesgo }));

const PELIGROSOS_PROV = { buenos_aires: 'Residuo especial (Ley 11.720 y Decreto 806/97)', caba: 'Residuo peligroso (Ley 2.214): corrientes Y y características H', cordoba: 'Residuo peligroso (Ley 8.973 y Decreto 2.149/03)', entre_rios: 'Residuo peligroso (adhesión a la Ley 24.051 y Decreto 4.977/09)', santa_fe: 'Residuo peligroso (Decreto 1.844/02)' };
const INDUSTRIAL_PROV = { buenos_aires: 'Residuo industrial no especial (Res. 137/13 y 317/20)', entre_rios: 'Residuo industrial no peligroso o asimilable (Decreto 4.977/09)', santa_fe: 'Residuo industrial no peligroso (Decreto 1.844/02), según el rubro' };

/** Régimen jurídico a partir de las respuestas. */
export function regimen(c) {
  const h = c.h ?? [];
  if (['patogenico', 'fito_a', 'fito_b', 'pcb', 'radiactivo', 'buque'].includes(c.cat)) return c.cat;
  if (c.origen === 'salud' && !['seco', 'humedo'].includes(c.cat)) return 'patogenico';
  const peligroso = h.length || c.y;
  if (['raee', 'nfu', 'avu', 'pilas', 'lamparas'].includes(c.cat)) return c.origen === 'vivienda' && peligroso ? 'peligroso_domiciliario_regu' : 'regu';
  if (peligroso) return c.origen === 'vivienda' ? 'peligroso_domiciliario' : 'peligroso';
  if (['voluminoso', 'poda', 'arido'].includes(c.cat)) return c.cat;
  if (c.cat === 'industrial') return 'industrial';
  return c.origen === 'vivienda' ? 'domiciliario' : 'asimilable';
}

/** Operación del Anexo III para un material reciclable según su nombre o categoría. */
export function operacionReciclado(nombre = '', categoria = '') {
  if (/alumin|metal|lata|chatarra|cobre|bronce/i.test(nombre) || categoria === 'metales') return ['R4', 'Reciclado de metales'];
  if (/vidrio/i.test(nombre) || categoria === 'vidrio') return ['R5', 'Reciclado de materias inorgánicas'];
  return ['R3', 'Reciclado de sustancias orgánicas (papel, cartón, plásticos)'];
}

/**
 * @param c { nombre?, origen, cat, h?, y?, riesgo? }
 * @param provincia clave de PROVINCIAS
 * @param perfil cooperativa | empresa | municipio | generador
 */
export function clasificar(c, provincia, perfil) {
  const t = regimen(c);
  const p = provincia;
  const P = PROVINCIAS[p];
  const leyGirsu = P?.leyes?.[0]?.norma ?? 'ley GIRSU provincial';
  const riesgo = { bajo: 'bajo', medio: 'medio', alto: 'alto' }[c.riesgo] ?? 'bajo';
  const h = c.h ?? [];
  const hTxt = h.map((k) => `${k} ${(CARACTERISTICAS_H[k] ?? '').toLowerCase()}`).join(', ');
  const fraccion = { seco: 'Fracción seca reciclable', humedo: 'Fracción húmeda / orgánica', rechazo: 'Fracción rechazo (no reciclable)' }[c.cat];
  const volumen = c.origen === 'gran' ? 'Gran generador: tiene que contratar recolección privada o una cooperativa registrada' : c.origen === 'vivienda' ? 'Domiciliario común, dentro del límite diario' : 'Si supera el umbral de la ordenanza, es gran generador';
  const opDom = c.cat === 'seco' ? operacionReciclado(c.nombre) : c.cat === 'humedo' ? ['R3', 'Compostaje o biodigestión'] : ['D1', 'Relleno sanitario'];
  const R = {
    domiciliario: { nacional: ['Residuo domiciliario', 'Ley 25.916'], provincial: `RSU domiciliario · ${leyGirsu}`, municipal: [fraccion, volumen], operacion: opDom, gestion: c.cat === 'seco' ? 'Recolección diferenciada → planta de clasificación o cooperativa' : c.cat === 'humedo' ? 'Compostaje, biodigestión o relleno sanitario' : 'Relleno sanitario habilitado', documentos: [], certificadoVerde: false },
    asimilable: { nacional: ['Residuo domiciliario (asimilable)', 'Ley 25.916'], provincial: c.origen === 'salud' && p === 'caba' ? 'Patogénico Tipo A: residuo común de un centro de salud (Ley 154)' : `Asimilable a RSU · ${leyGirsu}`, municipal: [fraccion, volumen], operacion: opDom, gestion: c.cat === 'seco' ? 'Cooperativa o empresa recicladora inscripta como destino sustentable' : c.cat === 'humedo' ? 'Compostaje o biodigestión; si no, relleno sanitario' : 'Relleno sanitario habilitado', documentos: c.cat === 'seco' ? ['Certificado verde del operador inscripto', 'Remito o manifiesto de cada traslado'] : ['Comprobante de recolección del transportista habilitado'], certificadoVerde: c.cat === 'seco' },
    industrial: { nacional: [`Residuo industrial · riesgo ${riesgo} (art. 7)`, 'Ley 25.612'], provincial: INDUSTRIAL_PROV[p] ?? 'Residuo industrial (régimen provincial y Ley 25.612)', municipal: ['Fuera de la recolección municipal', 'Lo gestiona el generador con un operador habilitado'], operacion: riesgo === 'alto' ? ['D9', 'Tratamiento fisicoquímico'] : ['R3 / R4', 'Reciclado como insumo de otro proceso'], gestion: 'Operador inscripto en el registro provincial de residuos industriales', documentos: ['Declaración jurada del generador (art. 12)', 'Documento de cada traslado (art. 21)', 'Constancia del reciclador que firma la declaración (art. 12)'], certificadoVerde: riesgo !== 'alto' },
    peligroso: { nacional: [`Residuo peligroso${c.y ? ` · ${c.y}` : ''}${hTxt ? ` · ${hTxt}` : ''}`, 'Ley 24.051 (Anexos I y II)'], provincial: PELIGROSOS_PROV[p] ?? 'Residuo peligroso (adhesión provincial a la Ley 24.051)', municipal: ['Fuera de la recolección municipal', 'Nunca en la bolsa común'], operacion: /aceite/i.test(c.nombre ?? '') || c.y === 'Y8' ? ['R9', 'Regeneración de aceites usados'] : ['D9 / D10', 'Tratamiento fisicoquímico o incineración'], gestion: 'Generador, transportista y operador inscriptos, con Certificado Ambiental Anual', documentos: ['Inscripción del generador en el registro de peligrosos', 'Manifiesto electrónico (SIMEL o sistema provincial)', 'Certificado de tratamiento o disposición final del operador'], certificadoVerde: false },
    peligroso_domiciliario: { nacional: [`Residuo peligroso de origen domiciliario${c.y ? ` · ${c.y}` : ''}`, 'Ley 24.051 y Ley 25.916'], provincial: `Gestión diferenciada · ${leyGirsu}`, municipal: ['Residuo peligroso domiciliario', 'Al punto limpio o ecopunto, nunca a la bolsa común'], operacion: ['D9 / D10', 'Tratamiento por operador habilitado'], gestion: 'Punto limpio municipal → operador de residuos peligrosos', documentos: ['Manifiesto del municipio al operador'], certificadoVerde: false },
    regu: { nacional: [`REGU · ${(CATEGORIAS[c.cat] ?? '').replace('REGU · ', '')}${c.y ? ` (contiene ${c.y}: puede ser peligroso)` : ''}`, 'Res. 522/2016 y 189/2019'], provincial: `REGU, gestión diferenciada${p === 'buenos_aires' ? ' (Res. OPDS 269/19)' : p === 'entre_rios' ? ' (Ley 10.311)' : ` · ${leyGirsu}`}`, municipal: [c.origen === 'vivienda' ? 'Punto limpio o ecopunto' : 'Gestión diferenciada del generador', 'Nunca en la bolsa común'], operacion: { avu: ['R9', 'Regeneración (biodiésel)'], nfu: ['R3', 'Reciclado del caucho'], raee: ['R4', 'Recuperación de metales'], pilas: ['R4', 'Recuperación de metales'], lamparas: ['R4', 'Recuperación de mercurio y metales'] }[c.cat], gestion: 'Operador habilitado para esa corriente', documentos: ['Certificado del operador habilitado para la corriente', ...(c.y ? ['Si es peligroso: manifiesto y certificado de tratamiento'] : [])], certificadoVerde: !c.y },
    voluminoso: { nacional: ['Residuo domiciliario', 'Ley 25.916'], provincial: `RSU · ${leyGirsu}`, municipal: ['Voluminoso doméstico', 'Campaña de descacharrización o punto limpio'], operacion: ['R4 / D1', 'Recuperación de metales; el resto a relleno'], gestion: 'Servicio municipal de voluminosos', documentos: [], certificadoVerde: false },
    poda: { nacional: ['Residuo domiciliario', 'Ley 25.916'], provincial: `RSU · ${leyGirsu}`, municipal: ['Poda y jardinería', 'Recolección diferencial municipal'], operacion: ['R3', 'Compostaje o chipeado'], gestion: 'Recolección de poda → compostaje', documentos: [], certificadoVerde: false },
    arido: { nacional: ['Residuo de obra (asimilable)', 'Ley 25.916 y normas locales'], provincial: p === 'caba' ? 'Áridos y restos de obra (Ley 4.859)' : p === 'cordoba' ? 'Residuos de obras y demoliciones (régimen propio)' : 'Áridos y restos de obra (ordenanza municipal)', municipal: ['Áridos y escombros', 'Volquete habilitado → escombrera o planta de trituración'], operacion: ['R5', 'Trituración y reúso como árido'], gestion: 'Volquete habilitado', documentos: ['Comprobante del volquete y del destino'], certificadoVerde: false },
    patogenico: { nacional: ['Residuo patogénico', 'Ley 24.051, art. 19'], provincial: p === 'caba' ? 'Patogénico Tipo B, biopatogénico (Ley 154)' : p === 'entre_rios' ? 'Residuo biopatogénico (normativa sanitaria y ambiental provincial)' : 'Residuo patogénico o biopatogénico (normativa provincial)', municipal: ['Fuera de la recolección municipal', 'Bolsa roja, nunca con los residuos comunes'], operacion: ['D9 / D10', 'Autoclave o incineración'], gestion: 'Transportista y operador habilitados para patogénicos', documentos: ['Manifiesto de transporte', 'Certificado de tratamiento'], certificadoVerde: false },
    fito_a: { nacional: ['Envase vacío de fitosanitario · Tipo A', 'Ley 27.279'], provincial: 'Envase de fitosanitario (Ley 27.279 y adhesión provincial)', municipal: ['Fuera de la recolección municipal', 'Nunca a la bolsa ni a la quema'], operacion: ['R3', 'Reciclado del plástico por operador habilitado'], gestion: 'Triple lavado (IRAM 12.069) → Centro de Almacenamiento Transitorio (CampoLimpio)', documentos: ['Certificado del CAT', 'Habilitación provincial del reciclador como operador'], certificadoVerde: false },
    fito_b: { nacional: ['Envase vacío de fitosanitario · Tipo B', 'Ley 27.279'], provincial: 'Envase de fitosanitario (Ley 27.279 y adhesión provincial)', municipal: ['Fuera de la recolección municipal', 'Nunca a la bolsa ni a la quema'], operacion: ['D10', 'Disposición final segura'], gestion: 'Centro de Almacenamiento Transitorio → disposición final segura', documentos: ['Certificado del CAT', 'Certificado de disposición final'], certificadoVerde: false },
    pcb: { nacional: ['PCB (más de 50 ppm)', 'Ley 25.670'], provincial: 'Residuo peligroso (régimen provincial)', municipal: ['Fuera de la recolección municipal', '—'], operacion: ['D10', 'Eliminación por operador habilitado'], gestion: 'Registro de poseedores de PCB y eliminación por operador habilitado. No se recicla', documentos: ['Inscripción en el registro de poseedores de PCB', 'Manifiesto y certificado de eliminación'], certificadoVerde: false },
    radiactivo: { nacional: ['Residuo radiactivo', 'Ley 25.018'], provincial: 'Fuera de la competencia provincial de residuos', municipal: ['Fuera de la recolección municipal', '—'], operacion: ['—', 'Gestión exclusiva de la CNEA'], gestion: 'Comisión Nacional de Energía Atómica (CNEA)', documentos: ['Documentación de la CNEA según su actividad y vida media'], certificadoVerde: false },
    buque: { nacional: ['Residuo de buque', 'Ley 24.051 y ordenanzas de la PNA (MARPOL)'], provincial: '—', municipal: ['Fuera de la recolección municipal', '—'], operacion: ['R9 / D9', 'Recepción portuaria y tratamiento'], gestion: 'Receptor portuario habilitado por la Prefectura Naval', documentos: ['Constancia de entrega en puerto'], certificadoVerde: false },
  };
  R.peligroso_domiciliario_regu = { ...R.regu, municipal: ['Residuo peligroso domiciliario', 'Al punto limpio o ecopunto'], certificadoVerde: false };
  const r = R[t];
  const derivar = ['No', `Derivalo: ${r.gestion}.`];
  const secoGG = ['domiciliario', 'asimilable'].includes(t) && c.cat === 'seco';
  const recibe = {
    cooperativa: secoGG ? ['si', 'Sí', 'Para certificarlo, tenés que estar inscripta como destino sustentable u operador.'] : t === 'regu' ? ['condicional', 'Solo si estás habilitada para esa corriente', 'Si no, derivalo a un operador habilitado.'] : t === 'industrial' && riesgo === 'bajo' ? ['condicional', 'Solo inscripta como operador industrial', 'Riesgo bajo, como insumo de reciclado.'] : ['no', ...derivar],
    empresa: secoGG ? ['si', 'Sí', 'Con la inscripción como destino sustentable u operador.'] : t === 'industrial' ? (riesgo === 'alto' ? ['condicional', 'Solo como operador de peligrosos', 'Riesgo alto: necesita tratamiento.'] : ['si', 'Sí, inscripta como operador industrial', 'Firmás la constancia del generador.']) : t === 'regu' ? ['condicional', 'Solo si estás habilitada para esa corriente', ''] : t === 'peligroso' ? ['condicional', 'Solo con Certificado Ambiental Anual como operador', 'Con manifiesto por cada traslado.'] : t === 'fito_a' ? ['condicional', 'Solo habilitada como operador por la provincia', 'Recibís del CAT, no del productor.'] : ['no', ...derivar],
    municipio: ['domiciliario', 'voluminoso', 'poda', 'peligroso_domiciliario', 'peligroso_domiciliario_regu'].includes(t) ? ['si', 'Sí, es tu servicio', r.municipal[1]] : t === 'regu' && c.origen === 'vivienda' ? ['si', 'Sí, en los puntos limpios', 'Después lo entregás a un operador habilitado para la corriente.'] : t === 'asimilable' ? (c.origen === 'gran' ? ['no', 'No: lo gestiona el gran generador', 'Controlá que tenga su certificado verde.'] : ['condicional', 'Sí, si no supera el umbral de gran generador', 'Controlá que tenga su certificado verde.']) : t === 'arido' ? ['condicional', 'Lo regulás, no lo recolectás', 'Exigí volquetes habilitados.'] : ['no', 'No es tu servicio', `Lo gestiona el generador: ${r.gestion}.`],
    generador: [r.certificadoVerde ? 'si' : 'condicional', r.certificadoVerde ? 'Entregalo a un operador inscripto y pedí el certificado verde' : 'Seguí su régimen propio', r.gestion],
  }[perfil] ?? null;
  return { regimen: t, ...r, operacion: { codigo: r.operacion[0], descripcion: r.operacion[1] }, recibe: recibe && { estado: recibe[0], respuesta: recibe[1], detalle: recibe[2] } };
}

/** Perfil del clasificador según la organización del usuario. */
export function perfilDe(org) {
  if (org?.tipo === 'municipio') return 'municipio';
  if (org?.tipo === 'empresa') return 'generador';
  return ['empresa', 'planta_publica'].includes(org?.perfil) ? 'empresa' : 'cooperativa';
}

const entrada = z.object({
  nombre: z.string().max(120).optional(),
  origen: z.enum(Object.keys(ORIGENES)),
  cat: z.enum(Object.keys(CATEGORIAS)),
  h: z.array(z.enum(Object.keys(CARACTERISTICAS_H))).max(14).default([]),
  y: z.union([z.enum(Object.keys(CORRIENTES_Y)), z.literal('')]).default(''),
  riesgo: z.enum(['bajo', 'medio', 'alto']).default('bajo'),
  provincia: z.enum(Object.keys(PROVINCIAS)).optional(),
});

/** Router común: lo montan el panel de la cooperativa y el portal. */
export const clasificadorRouter = Router();
clasificadorRouter.get('/catalogo', (_req, res) => {
  res.json({ catalogo: CATALOGO, origenes: ORIGENES, categorias: CATEGORIAS, caracteristicasH: CARACTERISTICAS_H, corrientesY: CORRIENTES_Y, provincias: Object.fromEntries(Object.entries(PROVINCIAS).map(([k, v]) => [k, v.nombre])) });
});
clasificadorRouter.post('/', async (req, res) => {
  const data = entrada.parse(req.body);
  const org = await Organization.findById(req.user.org).select('tipo perfil jurisdiccion').setOptions({ sinTenant: true });
  const provincia = data.provincia ?? org?.jurisdiccion?.provincia ?? 'entre_rios';
  res.json({ provincia, perfil: perfilDe(org), ...clasificar(data, provincia, perfilDe(org)) });
});
