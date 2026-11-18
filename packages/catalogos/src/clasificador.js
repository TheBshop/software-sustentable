// Clasificador de residuos en tres niveles y clasificación automática de materiales.
// Generado desde la página (nueva-vida-propuesta.html). Fuente única de estos datos para la API y la web.


export const ORIGENES = { vivienda: 'Vivienda', comercio: 'Comercio, oficina o institución', gran: 'Gran generador', industria: 'Industria o servicio', salud: 'Centro de salud', obra: 'Obra o demolición', campo: 'Campo', buque: 'Buque o puerto' };

export const CATS = {
  seco: 'Seco reciclable', humedo: 'Húmedo / orgánico', rechazo: 'Rechazo no reciclable', industrial: 'Residuo de proceso industrial',
  raee: 'REGU · Aparato eléctrico o electrónico (RAEE)', nfu: 'REGU · Neumático fuera de uso', avu: 'REGU · Aceite vegetal usado', pilas: 'REGU · Pilas y baterías', lamparas: 'REGU · Lámparas y tubos fluorescentes',
  voluminoso: 'Voluminoso doméstico', poda: 'Poda y jardinería', arido: 'Áridos, escombros y restos de obra',
  patogenico: 'Patogénico (infeccioso)', fito_a: 'Envase de fitosanitario lavable (Tipo A)', fito_b: 'Envase de fitosanitario no lavable (Tipo B)', pcb: 'Con PCB (más de 50 ppm)', radiactivo: 'Radiactivo', buque: 'De buque (MARPOL)',
};

export const H = { H1: 'Explosivo', H3: 'Líquido inflamable', 'H4.1': 'Sólido inflamable', 'H4.2': 'Combustión espontánea', 'H4.3': 'Gases inflamables con agua', 'H5.1': 'Oxidante', 'H5.2': 'Peróxido orgánico', 'H6.1': 'Tóxico agudo', 'H6.2': 'Infeccioso', H8: 'Corrosivo', H10: 'Gases tóxicos con aire o agua', H11: 'Tóxico crónico', H12: 'Ecotóxico', H13: 'Genera otra sustancia peligrosa' };

export const Y = { '': 'Ninguna', Y1: 'Y1 · Desechos clínicos', Y3: 'Y3 · Medicamentos', Y8: 'Y8 · Aceites minerales', Y9: 'Y9 · Mezclas aceite-agua', Y12: 'Y12 · Tintas, pinturas, barnices', Y29: 'Y29 · Mercurio', Y31: 'Y31 · Plomo', Y34: 'Y34 · Soluciones ácidas', Y42: 'Y42 · Solventes orgánicos' };

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
];

export const CLASIF_MAT = {
  Cartón: ['R3', 'Reciclado de papel y cartón'], Papel: ['R3', 'Reciclado de papel y cartón'], 'Tetra Pak': ['R3', 'Reciclado de fibra y PolyAl'],
  PET: ['R3', 'Reciclado de plásticos'], PEAD: ['R3', 'Reciclado de plásticos'], 'PEBD / film': ['R3', 'Reciclado de plásticos'], PP: ['R3', 'Reciclado de plásticos'],
  Vidrio: ['R5', 'Reciclado de materiales inorgánicos'], Aluminio: ['R4', 'Reciclado de metales'], Chatarra: ['R4', 'Reciclado de metales'],
};

export function clasif(mat, origen = '') {
  const c = CLASIF_MAT[mat];
  const asimilable = /generador|industria|comercio/i.test(origen);
  return c
    ? { op: c[0], txt: `${asimilable ? 'Asimilable a RSU' : 'RSU'} · fracción seca reciclable (Ley 25.916) · ${c[0]} ${c[1].toLowerCase()}` }
    : { op: '—', txt: 'Sin clasificación automática: usá Cumplimiento › Clasificar residuos' };
}
