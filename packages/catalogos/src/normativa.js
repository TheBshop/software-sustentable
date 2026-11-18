// Normativa nacional, provincial (24 jurisdicciones) y municipal (76 municipios), obligaciones y autodiagnóstico.
// Generado desde la página (nueva-vida-propuesta.html). Fuente única de estos datos para la API y la web.


export const PROV = {
  caba: ['Ciudad Autónoma de Buenos Aires', 'Ley 1.854 "Basura Cero"', 'Generadores especiales: inscripción, separación y plan anual (Res. 454/2021)'],
  buenos_aires: ['Buenos Aires', 'Ley 13.592; Ley 14.321 (RAEE)', 'Más de 1.000 kg por mes: plan de gestión integral e inclusiva (Res. OPDS 317/2020)'],
  cordoba: ['Córdoba', 'Ley 9.088', 'Córdoba Capital: 200 kg o 0,4 m³ diarios, registro y certificado del IPA (Ord. 12.648)'],
  santa_fe: ['Santa Fe', 'Ley 13.055 "Basura Cero"; Ley 13.940 (RAEE)', 'Rosario: régimen de grandes generadores (Ord. 7.600 y 9.463)'],
  entre_rios: ['Entre Ríos', 'Ley 10.311', 'Paraná: la Ord. 9.233 remite a una norma específica'],
  mendoza: ['Mendoza', 'Ley 9.659 GIRSU', 'Más de 50 kg diarios'],
  la_pampa: ['La Pampa', 'Sin ley GIRSU provincial: competencia municipal', null],
  san_juan: ['San Juan', 'Ley 8.238 / 1114-L', null],
  san_luis: ['San Luis', 'Ley IX-0873-2013', null],
  tucuman: ['Tucumán', 'Ley 8.177', null],
  salta: ['Salta', 'Ley 7.070 y Decreto 1.365/2010', null],
  corrientes: ['Corrientes', 'Ley 6.422', null],
  chaco: ['Chaco', 'Ley 7.034', null],
  misiones: ['Misiones', 'Ley XVI N° 89; Ley XVI N° 133 (RAEE)', null],
  jujuy: ['Jujuy', 'Ley 5.954 (GIRSU Jujuy S.E.)', null],
  neuquen: ['Neuquén', 'Ley 2.648', null],
  chubut: ['Chubut', 'Ley XI N° 50', null],
  rio_negro: ['Río Negro', 'Ley 5.491', null],
  catamarca: ['Catamarca', 'Ley provincial de residuos: a verificar', null],
  formosa: ['Formosa', 'Ley provincial de residuos: a verificar', null],
  la_rioja: ['La Rioja', 'Ley provincial de residuos: a verificar', null],
  santa_cruz: ['Santa Cruz', 'Ley provincial de residuos: a verificar', null],
  santiago_del_estero: ['Santiago del Estero', 'Ley provincial de residuos: a verificar', null],
  tierra_del_fuego: ['Tierra del Fuego', 'Ley provincial de residuos: a verificar', null],
};

export const JUR = {
  buenos_aires: { nombre: 'Provincia de Buenos Aires', doc: 'Certificado de Destino Sustentable', registro: 'Inscripción en el Registro de Destinos Sustentables (Res. OPDS 44/2021)', extra: [['El traslado consta en un manifiesto de transporte digital', (c) => c.tipoDoc === 'Manifiesto digital']], nota: 'Se emite en el portal del Ministerio de Ambiente bonaerense, vinculado al manifiesto y al balance de masa.' },
  caba: { nombre: 'Ciudad de Buenos Aires', doc: 'Constancia de recepción y tratamiento', registro: 'Inscripción en el RUR (cooperativas) o habilitación de la APrA (operadores privados)', extra: [], nota: 'Respalda la declaración jurada anual del generador especial (Ley 1.854).' },
  entre_rios: { nombre: 'Entre Ríos', doc: 'Certificado de valorización', registro: 'Inscripción en el registro de operadores de la Secretaría de Ambiente', extra: [], nota: 'Ley 10.311 y Decreto 4.977/09, más las ordenanzas de cada municipio.' },
  santa_fe: { nombre: 'Santa Fe', doc: 'Certificado de valorización', registro: 'Inscripción en el Registro Provincial de Operadores de Residuos Industriales No Peligrosos', extra: [], nota: 'Ley 13.055 y Decreto 1.844/02.' },
  cordoba: { nombre: 'Córdoba', doc: 'Certificado de valorización', registro: 'Inscripción en el registro provincial de operadores o centro verde municipal autorizado', extra: [], nota: 'Ley 9.088 y resoluciones de la Secretaría de Ambiente.' },
  otra: { nombre: 'Otra provincia', doc: 'Certificado de tratamiento y disposición', registro: 'Inscripción en el registro provincial de operadores', extra: [], nota: 'Consultá a la autoridad ambiental de tu provincia qué registro corresponde.' },
};

export const OBL_RES = {
  raee: { id: 'rraee', titulo: 'RAEE: entregarlos a un operador habilitado', norma: 'Res. 522/2016 y leyes provinciales de RAEE', que: 'Sin desarmarlos si no tenés la habilitación.', ayuda: 'Clasificador de residuos', salvo: 'raee' },
  avu: { id: 'ravu', titulo: 'Aceite vegetal usado: solo a un operador inscripto', norma: 'Res. 522/2016 y normas locales', que: 'Con constancia de entrega; nunca a la red cloacal.', ayuda: 'Clasificador de residuos' },
  nfu: { id: 'rnfu', titulo: 'Neumáticos fuera de uso: operador habilitado', norma: 'Res. 522/2016 y normas locales', que: 'Acopio bajo techo y entrega con constancia.', ayuda: 'Clasificador de residuos' },
  obra: { id: 'robra', titulo: 'Áridos y restos de obra: volquete y destino habilitados', norma: 'Ordenanzas municipales (p. ej. CABA, Ley 4.859)', que: 'Comprobante del volquete y del destino de cada carga.', ayuda: 'Clasificador de residuos' },
  industriales: { id: 'rind', titulo: 'Industriales no peligrosos: inscripción como operador', norma: 'Ley 25.612 y registro provincial', que: 'Recibirlos con documento de traslado y clasificar su riesgo.', ayuda: 'Clasificador de residuos', solo: ['cooperativa', 'municipio'] },
};

export const TEMAS = { sep: 'Separación en origen', gg: 'Grandes generadores', rec: 'Recuperadores urbanos', pv: 'Puntos verdes o limpios', raee: 'RAEE', avu: 'Aceite vegetal usado', nfu: 'Neumáticos', vol: 'Voluminosos', pilas: 'Pilas', mb: 'Microbasurales', pesq: 'Residuos pesqueros', ind: 'Industriales asimilables', dest: 'Destinos sustentables', esp: 'Residuos de manejo especial', pel: 'Peligrosos' };

export const SIBOM = ['https://sibom.slyt.gba.gob.ar', 1];

export const L = (n, t, ok = 0) => [n, t, ok];

export const GG_PBA = ['Más de 1.000 kg por mes (Res. OPDS 317/2020, provincial)', 1];

export const GG_MZA = ['Más de 50 kg por día (reglamentación provincial)', 1];

export const SIN = 'No encontramos estas ordenanzas en las fuentes consultadas: confirmalas en el digesto.';

export const MUNI_LISTA = [
  ['caba', 'caba', 'Ciudad de Buenos Aires', [L('Ley 1.854', 'Basura Cero', 1), L('Ley 992', 'Recuperadores urbanos', 1), L('Res. 454/2021', 'Generadores especiales: inscripción, separación y plan anual', 1), L('Ley 5.991', 'Según el listado: pilas y generadores especiales'), L('Ley 4.859', 'Áridos y restos de obra')], 'sep gg rec pilas', ['Generadores especiales según la Res. 454/2021', 1], ['https://boletinoficial.buenosaires.gob.ar', 1]],
  ['buenos_aires', 'la_plata', 'La Plata', [L('Ord. 10.661', 'GIRSU "Basura Cero" (2009)', 1), L('Ord. 12.590', 'Según el listado: grandes generadores y destinos sustentables')], 'sep gg dest rec', GG_PBA, SIBOM, 'Programa Bolsa Verde, según el listado.'],
  ['cordoba', 'cordoba', 'Córdoba (capital)', [L('Ord. 12.648', 'Marco GIRSU: separación en origen y grandes generadores con registro y certificado del IPA', 1), L('Decreto 52/2019', 'Reglamentación, según el listado'), L('Ord. 13.228', 'Modificatoria')], 'sep gg', ['200 kg o 0,4 m³ por día', 1], ['https://cordoba.gob.ar', 0]],
  ['santa_fe', 'santa_fe_capital', 'Santa Fe (capital)', [L('Ord. 11.917', 'Residuos de manejo especial: transporte, disposición final y grandes generadores', 1), L('Ord. 12.393', 'Según el listado: separación en húmedos y secos')], 'esp gg sep', null, ['https://www.concejosantafe.gov.ar/wp-content/uploads/Ordenanza/Ordenanza_11917.pdf', 1]],
  ['entre_rios', 'parana', 'Paraná', [L('Ord. 9.233', 'GIRSU: separación en origen, recuperadores y registro de depósitos de acopio (art. 28)', 1), L('Ord. 9.601/2017', 'Registro municipal de generadores y operadores de residuos peligrosos (modifica la Ord. 8.886/2009)', 1), L('Ord. 9.931', 'Según el listado: modifica la 9.233'), L('Ord. 9.010', 'Según el listado: RAEE y grandes generadores')], 'sep rec gg raee pel', ['La Ord. 9.233 remite a una norma específica: pedila al municipio', 0], ['https://digesto.parana.gob.ar', 0]],
  ['mendoza', 'mendoza_capital', 'Mendoza (capital)', [L('Ord. 3.877', 'Según el listado: gestión integral de RSU (la norma existe; el tema falta confirmarlo)'), L('Ord. 4.022', 'Según el listado: recolección diferenciada'), L('Ord. 4.232', 'Arrojo de residuos en la vía pública y en acequias', 1), L('Ord. 4.000', 'Prohibición de bolsas plásticas', 1)], 'sep gg', GG_MZA, ['https://hcd.ciudaddemendoza.gov.ar', 1]],
  ['tucuman', 'smt', 'San Miguel de Tucumán', [L('Ord. 5.079/2020', 'Recolección diferenciada de RSU', 1), L('Ord. 4.384 y 4.918', 'Según el listado: higiene urbana y puntos limpios'), L('Registro de grandes generadores', 'Inscripción, separación y recolección contratada (proyecto de Código Ambiental)')], 'sep pv gg', ['Más de 30 kg por día', 0], ['https://www.smt.gob.ar', 1]],
  ['salta', 'salta', 'Salta (capital)', [L('Ord. 15.415/2017', 'GIRU: generadores individuales y especiales', 1), L('Ord. 15.724', 'Según el listado: recuperadores y aceite vegetal usado')], 'sep rec avu gg', ['Generadores especiales (Ord. 15.415)', 0], ['https://municipalidadsalta.gob.ar', 1]],
  ['corrientes', 'corrientes_capital', 'Corrientes (capital)', [L('Ord. 6.605 y 6.722', 'Según el listado: plan GIRSU, puntos verdes y grandes generadores')], 'sep pv gg', null, ['https://ciudaddecorrientes.gov.ar', 1], SIN],
  ['chaco', 'resistencia', 'Resistencia', [L('Ord. 11.797 y 13.428', 'Según el listado: GIRSU, ecopuntos, recuperadores y voluminosos')], 'pv rec vol', null, ['https://resistencia.gob.ar', 0], SIN],
  ['misiones', 'posadas', 'Posadas', [L('Ord. VI - N° 29', 'Programa GIRSU (2014)', 1), L('Ord. VI - N° 8', 'Residuos patológicos (adhiere a la Ley Q-1784)', 1), L('Ord. III - N° 183', 'Según el listado: centros verdes, neumáticos y RAEE')], 'sep pv nfu raee rec', null, ['https://posadas.gov.ar/sustentable', 1]],
  ['jujuy', 'ss_jujuy', 'San Salvador de Jujuy', [L('Ord. 6.425 y 7.450', 'Según el listado: adhesión GIRSU Jujuy y grandes generadores')], 'sep gg', null, ['https://cdjujuy.gob.ar', 0], SIN],
  ['santiago_del_estero', 'sde', 'Santiago del Estero (capital)', [L('Ord. 4.950 y 5.512', 'Según el listado: higiene urbana, secos y húmedos, microbasurales')], 'sep mb', null, ['https://santiagociudad.gov.ar', 0], SIN],
  ['catamarca', 'catamarca', 'San Fernando del Valle de Catamarca', [L('Ord. 6.530 y 7.589', 'Según el listado: GIRSU, puntos limpios y grandes generadores')], 'sep pv gg', null, ['https://catamarcaciudad.gob.ar', 0], SIN],
  ['la_rioja', 'la_rioja', 'La Rioja (capital)', [L('Ord. 5.215 y 5.890', 'Según el listado: GIRSU, centros de transferencia e higiene urbana')], 'sep', null, ['https://municipiolarioja.gob.ar', 0], SIN],
  ['san_juan', 'san_juan', 'San Juan (capital)', [L('Ord. 10.674 y 12.980', 'Según el listado: separación en origen, Parque de Tecnologías Ambientales y grandes generadores')], 'sep gg', null, ['https://municipiosanjuan.gob.ar', 0], SIN],
  ['san_luis', 'san_luis', 'San Luis (capital)', [L('Ord. 3.412 y 3.685', 'Según el listado: GIRSU, puntos limpios y recolección diferenciada')], 'sep pv', null, ['https://ciudaddesanluis.gov.ar', 0], SIN],
  ['la_pampa', 'santa_rosa', 'Santa Rosa', [L('Ord. 5.342 y 6.410', 'Según el listado: planta de clasificación, grandes generadores y aceite vegetal usado')], 'sep gg avu', null, ['https://santarosa.gob.ar', 0], SIN],
  ['neuquen', 'neuquen', 'Neuquén (capital)', [L('Ord. 14.463', 'Tasa de compensación ambiental por tratamiento y disposición final en el Complejo Ambiental', 1), L('Tasa diferenciada', 'Los grandes generadores pagan una tasa de recolección más alta', 1), L('Ord. 12.155 y 14.120', 'Según el listado: GIRSU, separación y RAEE'), L('Proyecto de grandes generadores', 'En debate: gestión propia y separación en húmedos y secos')], 'sep gg raee', null, ['https://www.cdneuquen.gob.ar', 0]],
  ['rio_negro', 'viedma', 'Viedma', [L('Ord. 7.456 y 8.312', 'Según el listado: GIRSU regional Viedma-Patagones y grandes generadores')], 'sep gg', null, ['https://concejoviedma.gov.ar', 0], SIN],
  ['chubut', 'rawson', 'Rawson', [L('Ord. 7.340 y 8.125', 'Según el listado: GIRSU VIRCh-Valdés y residuos pesqueros')], 'sep pesq', null, ['https://rawson.gov.ar', 0], SIN],
  ['santa_cruz', 'rio_gallegos', 'Río Gallegos', [L('Ord. 8.240 y 9.410', 'Según el listado: puntos verdes, separación y voluminosos')], 'sep pv vol', null, ['https://riogallegos.gov.ar', 0], SIN],
  ['tierra_del_fuego', 'ushuaia', 'Ushuaia', [L('Ord. 4.120 y 5.680', 'Según el listado: reciclaje de plásticos y cartón, RAEE e industriales asimilables')], 'sep raee ind', null, ['https://concejoushuaia.com', 0], SIN],
  ['formosa', 'formosa', 'Formosa (capital)', [L('Ord. 6.845 y 7.490', 'Según el listado: higiene urbana y recolección diferenciada')], 'sep', null, ['https://formosatuciudad.gob.ar', 0], SIN],
  // Grandes municipios del interior
  ['santa_fe', 'rosario', 'Rosario', [L('Ord. 8.335', 'Basura Cero', 1), L('Ord. 7.007 y 7.600/2003 (mod. 9.463/2015)', 'Régimen de grandes generadores', 1), L('Ord. 9.477', 'Según el listado: grandes generadores', -1)], 'sep gg', null, ['https://www.rosario.gob.ar/inicio/sites/default/files/2026-05/MR_ficha_47_26.pdf', 1], 'Meta municipal 2030: todos los grandes generadores separando en tres fracciones.'],
  ['santa_fe', 'venado_tuerto', 'Venado Tuerto', [L('Ord. 5.908/2024', 'Grandes generadores', 1)], 'gg', ['Comercios con más de 0,5 m³ por día', 1], ['https://venadotuerto.gob.ar', 1]],
  ['buenos_aires', 'mar_del_plata', 'Mar del Plata (General Pueyrredon)', [L('Ord. 20.002', 'Los grandes generadores quedan fuera de la recolección domiciliaria municipal', 1), L('Res. 89/13', 'Registro de Grandes Generadores del partido', 1), L('Ord. 24.498', 'Según el listado: grandes generadores')], 'sep gg', ['Más de 20 kg por día', 0], ['https://www.concejomdp.gov.ar', 1]],
  ['buenos_aires', 'bahia_blanca', 'Bahía Blanca', [L('Ord. 19.374 (mod. 20.319)', 'Gestión integral e inclusiva de los RSU', 1), L('Ord. 17.648 y 19.850', 'Según el listado: EcoPlanta y grandes generadores')], 'sep gg rec', GG_PBA, SIBOM, 'Rige una ordenanza de grandes generadores; el número no está confirmado.'],
  ['buenos_aires', 'san_nicolas', 'San Nicolás de los Arroyos', [L('Ord. 10.318/2021', 'Régimen de medianos generadores', 1), L('Ord. 9.310', 'Según el listado: GIRSU y Complejo Ambiental')], 'sep gg', GG_PBA, SIBOM],
  ['buenos_aires', 'tandil', 'Tandil', [L('Ord. 14.320', 'Según el listado: puntos limpios y separación')], 'pv sep gg', GG_PBA, SIBOM],
  ['buenos_aires', 'bolivar', 'Bolívar', [L('Ord. 3.049/2024', 'Grandes generadores: plan de gestión, registro municipal en 60 días y separación en seca y húmeda', 1)], 'gg sep', GG_PBA, ['https://bolivar.gob.ar', 1]],
  ['buenos_aires', 'avellaneda', 'Avellaneda', [L('Ordenanza de 2016', 'Registro municipal de grandes generadores', 1)], 'gg sep', GG_PBA, SIBOM],
  ['rio_negro', 'bariloche', 'San Carlos de Bariloche', [L('Ord. 1265-CM-03', 'Grandes generadores comerciales: clasificación y tasas', 1), L('Ord. 1698-CM-07', 'Clasificación en origen de los RSU', 1), L('Res. 3767-I-2019', 'Categorización y control de la separación de los grandes generadores', 1), L('Ord. 1421-CM-04 y 606-26', 'Según el listado')], 'gg sep', null, ['https://www.bariloche.gov.ar', 1], 'En 2026 empezó una prueba piloto de separación en el centro.'],
  ['cordoba', 'rio_cuarto', 'Río Cuarto', [L('Ord. 1.124/11', 'Según el listado: GIRSU, Centro de Reciclaje y grandes generadores')], 'sep gg', null, ['https://concejoriocuarto.gob.ar', 0], SIN],
  ['cordoba', 'villa_maria', 'Villa María', [L('Ord. 6.915', 'Según el listado: GIRSU y planta de separación')], 'sep', null, ['https://villamaria.gob.ar', 0], SIN],
  ['entre_rios', 'concordia', 'Concordia', [L('Ord. 35.120', 'Según el listado: adhesión GIRSU y separación en origen')], 'sep', null, ['https://concordia.gob.ar', 0], SIN],
  ['entre_rios', 'gualeguaychu', 'Gualeguaychú', [L('Ord. 11.830/2013', 'Según el listado: GIRSU, Ecoparque y separación domiciliaria')], 'sep', null, ['https://gualeguaychu.gov.ar', 1], 'En el sitio oficial figura la Ord. 11.844/2013: confirmá cuál es la de residuos.'],
  ['mendoza', 'godoy_cruz', 'Godoy Cruz', [L('Plan GIRSU municipal', 'Aprobado por ordenanza, con obligaciones para grandes generadores', 1), L('Ord. 6.645', 'Según el listado: puntos verdes y grandes generadores')], 'sep gg pv', GG_MZA, ['https://hcdgodoycruz.gob.ar', 0]],
  ['mendoza', 'guaymallen', 'Guaymallén', [L('Ord. 8.540', 'Según el listado: puntos verdes y grandes generadores')], 'pv gg', GG_MZA, ['https://guaymallen.gob.ar', 0], SIN],
  ['mendoza', 'las_heras', 'Las Heras', [L('Ord. 50/2024', '"Las Heras Verde": recuperación inclusiva de RSU', 1)], 'rec sep gg', GG_MZA, null],
  ['mendoza', 'maipu', 'Maipú', [], 'pv gg', GG_MZA, null, 'No relevamos su ordenanza: rige la reglamentación provincial.'],
  ['chubut', 'comodoro', 'Comodoro Rivadavia', [L('Plan GIRSU Comodoro', 'Plan municipal de gestión integral', 1), L('Ord. 11.420/14', 'Según el listado: puntos verdes e iglúes')], 'sep pv', null, ['https://concejocomodoro.gob.ar', 0]],
  ['chubut', 'trelew', 'Trelew', [L('Ord. 12.110', 'Según el listado: consorcio GIRSU VIRCh-Valdés')], 'sep', null, ['https://trelew.gov.ar', 0], SIN],
  ['chubut', 'puerto_madryn', 'Puerto Madryn', [L('Ord. 8.950', 'Según el listado: consorcio GIRSU VIRCh-Valdés')], 'sep', null, ['https://madryn.gob.ar', 0], SIN],
  ['tierra_del_fuego', 'rio_grande', 'Río Grande', [L('Ord. 3.450', 'Según el listado: RSU, RAEE y neumáticos')], 'sep raee nfu', null, ['https://concejoriogrande.gob.ar', 0], SIN],
];

export const PBA_SIN_RELEVAR = ['La Matanza', 'Lomas de Zamora', 'Quilmes', 'Almirante Brown', 'Merlo', 'Moreno', 'Florencio Varela', 'Lanús', 'General San Martín', 'Tres de Febrero', 'Tigre', 'Malvinas Argentinas', 'José C. Paz', 'Pilar', 'Escobar', 'San Isidro', 'Vicente López', 'Berazategui', 'Esteban Echeverría', 'Ezeiza', 'Hurlingham', 'Ituzaingó', 'Morón', 'San Fernando', 'San Miguel', 'Zárate', 'Campana', 'Luján', 'Pergamino', 'Junín', 'Olavarría', 'Necochea', 'Tres Arroyos'];

export const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\W+/g, '_');

export const MUNI = {};

for (const [p, id, n, normas, temas, gg, link, nota] of MUNI_LISTA) (MUNI[p] ??= {})[id] = { n, normas, temas: temas.split(' ').filter(Boolean), gg, link, nota };

for (const n of PBA_SIN_RELEVAR) MUNI.buenos_aires[slug(n)] ??= { n, normas: [L('Ley 13.592', 'GIRSU provincial', 1), L('Res. OPDS 317/2020', 'Grandes generadores: plan de gestión integral e inclusiva', 1)], temas: ['gg', 'sep', 'dest'], gg: GG_PBA, link: SIBOM, nota: 'No relevamos su ordenanza propia: buscala en el SIBOM eligiendo el municipio y la palabra "GIRSU" o "grandes generadores".' };

export const OBL_MUNI = {
  gg: { planta: ['Retirar a grandes generadores con habilitación municipal', 'Inscripción como transportista u operador y constancia de cada retiro.'], municipio: ['Padrón y control de grandes generadores', 'Inscripción, plan de gestión y separación en origen.'] },
  sep: { planta: ['Recibir la fracción seca de la recolección diferenciada', 'Registrar lo que entrega la recolección municipal.'], municipio: ['Recolección diferenciada de secos y húmedos', 'Días, circuitos y campañas según la ordenanza.'] },
  rec: { planta: ['Inscripción en el registro municipal de recuperadores u organizaciones', 'Condición habitual para convenios y pagos por servicio.'], municipio: ['Registro e inclusión de recuperadores urbanos', 'Censo, credencial y elementos de protección.'] },
  pv: { planta: ['Recibir el material de los puntos verdes o limpios', 'Según el convenio con el municipio.'], municipio: ['Puntos verdes o limpios en funcionamiento', 'Ubicación, horarios y destino de lo recibido.'] },
  raee: { todos: ['RAEE según la ordenanza local', 'Recepción diferenciada y entrega a un operador habilitado.'] },
  avu: { todos: ['Aceite vegetal usado según la ordenanza local', 'Registro de generadores y entrega a un operador inscripto.'] },
  nfu: { todos: ['Neumáticos según la ordenanza local', 'Acopio y entrega a un operador habilitado.'] },
  pilas: { todos: ['Pilas según la norma local', 'Recepción diferenciada, nunca con los RSU.'] },
  vol: { municipio: ['Servicio de voluminosos', 'Recolección programada o puntos de entrega.'] },
  mb: { municipio: ['Erradicar microbasurales', 'Relevamiento, limpieza y control.'] },
  pesq: { todos: ['Residuos pesqueros con gestión diferenciada', 'Fuera de la recolección domiciliaria.'] },
  ind: { planta: ['Industriales asimilables: condiciones de recepción', 'Solo los que la ordenanza asimila a RSU.'] },
  dest: { planta: ['Inscripción como destino sustentable', 'Para que tus certificados valgan ante el municipio y la provincia.'] },
  esp: { todos: ['Residuos de manejo especial: transporte y destino autorizados', 'Solo transportistas y destinos habilitados por el municipio.'] },
  pel: { planta: ['Registro municipal de generadores y operadores de peligrosos', 'Si generás u operás residuos peligrosos.'] },
};

export const OBL = {
  cooperativa: [
    { id: 'c1', titulo: 'Inscripción en INAES y autoridades vigentes', norma: 'Ley 20.337 de cooperativas', que: 'Asambleas, balances y padrón de asociados al día.', ayuda: 'Balance mensual exportable' },
    { id: 'c2', titulo: 'Habilitación municipal del acopio o la planta', norma: 'Ordenanzas locales (p. ej. Paraná, Ord. 9.233, art. 28)', que: 'Habilitación comercial y registro municipal de depósitos de acopio.', ayuda: 'La inscripción se imprime en cada certificado' },
    { id: 'c3', titulo: 'Separar corrientes y registrar cada etapa', norma: 'Ley 25.916 y Decreto 779/2022', que: 'Trazabilidad de lo valorizado y lo dispuesto, con el código de colores por fracción.', ayuda: 'Registros de ingresos, separado y rechazo' },
    { id: 'c4', titulo: 'Gestionar aparte los residuos especiales (REGU)', norma: 'Res. 522/2016 y 189/2019', que: 'Pilas, RAEE, neumáticos y aceite usado, en una corriente separada.', ayuda: 'Corriente REGU separada en la plataforma' },
    { id: 'c5', titulo: 'No recibir residuos peligrosos sin inscripción', norma: 'Ley 24.051', que: 'Solo operadores inscriptos, con manifiesto por traslado.', ayuda: 'Bloqueo de corrientes no habilitadas' },
    { id: 'c6', titulo: 'Protección y capacitación del personal', norma: 'Ley 19.587 y normas locales', que: 'Elementos de protección, capacitación y registro de accidentes.', ayuda: 'Registros de EPP, capacitaciones y accidentes' },
    { id: 'c9', titulo: 'Recibir solo las corrientes para las que estás habilitada', norma: 'Leyes 25.916, 25.612, 24.051 y regímenes especiales', que: 'Separar las incompatibles y derivar peligrosos, patogénicos, PCB y fitosanitarios.', ayuda: 'Clasificador de residuos' },
    { id: 'c8', titulo: 'Inscribirte como destino sustentable u operador', norma: 'PBA: Res. OPDS 44/2021 · registros provinciales de operadores', que: 'Sin esa inscripción tus certificados no cortan la responsabilidad del generador.', ayuda: 'Certificado verde: requisitos por jurisdicción' },
    { id: 'c7', titulo: 'Certificar la disposición a grandes generadores', norma: 'Normas de grandes generadores de cada jurisdicción', que: 'Respaldo de lo retirado para el plan del generador.', ayuda: 'Certificados con QR y constancia anual' },
  ],
  empresa: [
    { id: 'e1', titulo: 'Habilitación como planta de tratamiento', norma: 'Ley 25.612, arts. 29 a 33', que: 'Estudio de impacto ambiental y declaración de la autoridad antes de operar.', ayuda: null },
    { id: 'e2', titulo: 'Registro de operaciones permanente', norma: 'Ley 25.612, art. 34', que: 'Todo lo que entra, se procesa y sale de la planta.', ayuda: 'Registros de compras, procesado, descarte y ventas' },
    { id: 'e3', titulo: 'Documentar cada traslado', norma: 'Ley 25.612, arts. 21 a 23', que: 'Naturaleza, cantidad, origen, transportista y destino de los residuos.', ayuda: 'Registro de documentos de traslado' },
    { id: 'e4', titulo: 'Constancias para la declaración jurada del generador', norma: 'Ley 25.612, arts. 11 inc. e y 12', que: 'Quien recicla firma la declaración del generador que recicla.', ayuda: 'Registro de constancias y constancia anual' },
    { id: 'e5', titulo: 'Seguro ambiental o garantía equivalente', norma: 'Ley 25.612, arts. 27 y 38', que: 'Cobertura para recomponer posibles daños ambientales.', ayuda: null },
    { id: 'e6', titulo: 'Residuos peligrosos solo con inscripción y manifiesto', norma: 'Ley 24.051 (vigente)', que: 'Registro de operador y manifiesto en línea (SIMEL / GIRO).', ayuda: 'Bloqueo de corrientes no habilitadas' },
    { id: 'e9', titulo: 'Clasificar cada residuo y su nivel de riesgo', norma: 'Ley 25.612, art. 7 y 11 inc. b; Ley 24.051, Anexos I a III', que: 'Riesgo bajo, medio o alto; corrientes Y, características H y operación R o D.', ayuda: 'Clasificador de residuos' },
    { id: 'e8', titulo: 'Inscribirte como destino sustentable u operador', norma: 'PBA: Res. OPDS 44/2021 · registros provinciales de operadores', que: 'Sin esa inscripción tus certificados no cortan la responsabilidad del generador.', ayuda: 'Certificado verde: requisitos por jurisdicción' },
    { id: 'e7', titulo: 'Protección y capacitación del personal', norma: 'Ley 19.587 y normas locales', que: 'Elementos de protección, capacitación y registro de accidentes.', ayuda: 'Registros de EPP, capacitaciones y accidentes' },
  ],
  municipio: [
    { id: 'm1', titulo: 'Garantizar la recolección y el transporte', norma: 'Ley 25.916 y ordenanzas', que: 'Servicio de recolección hasta la planta y el sitio de disposición.', ayuda: 'Registro de recolección por circuito' },
    { id: 'm2', titulo: 'Plan de gestión integral (GIRSU) municipal', norma: 'Ley provincial de residuos', que: 'Plan con objetivos, etapas y plazos, presentado a la provincia.', ayuda: 'Indicadores mensuales para el seguimiento' },
    { id: 'm3', titulo: 'Separación en origen y recolección diferenciada', norma: 'Ley 25.916 y Decreto 779/2022', que: 'Implementación progresiva, con el código de colores por fracción.', ayuda: 'Indicador de recolección diferenciada' },
    { id: 'm4', titulo: 'Erradicar basurales a cielo abierto', norma: 'Leyes provinciales (p. ej. Río Negro 5.491, Chaco 7.034)', que: 'Relevamiento, cierre y saneamiento.', ayuda: 'Registro de basurales y su estado' },
    { id: 'm5', titulo: 'Regular a los grandes generadores', norma: 'Normas locales y provinciales', que: 'Padrón, inscripción y control de su gestión.', ayuda: 'Padrón de grandes generadores' },
    { id: 'm6', titulo: 'Incluir a los recuperadores urbanos', norma: 'Normas locales (p. ej. CABA Ley 1.854, Paraná Ord. 9.233)', que: 'Censo, organización y condiciones dignas de trabajo.', ayuda: 'Censo de recuperadores' },
    { id: 'm9', titulo: 'Servicios diferenciados por tipo de residuo', norma: 'Ordenanzas de higiene urbana', que: 'Secos, húmedos y rechazo; poda, voluminosos, áridos y puntos limpios para peligrosos domiciliarios.', ayuda: 'Clasificador de residuos' },
    { id: 'm8', titulo: 'Exigir certificados válidos a los grandes generadores', norma: 'Ley 25.675, Ley 25.612 y normas de grandes generadores', que: 'El generador responde por su residuo hasta que un operador habilitado lo certifica.', ayuda: 'Verificador de certificados' },
    { id: 'm7', titulo: 'Educación ambiental permanente', norma: 'Ley 25.916 y ordenanzas', que: 'Campañas para separar en origen y reducir residuos.', ayuda: 'Registro de actividades' },
  ],
};

export const SEG = { g: 'Seguridad e higiene', items: [['seg1', 'Instalación contra incendios según carga de fuego'], ['seg2', 'Personal capacitado en seguridad e higiene', 'Registro de capacitaciones'], ['seg3', 'Elementos de protección entregados', 'Registro de entregas de EPP'], ['seg4', 'Paradas de emergencia y puesta a tierra'], ['seg5', 'Señalización de sectores y circulación'], ['seg6', 'Seguro de accidentes de trabajo']] };

export const DIAG = {
  cooperativa: [
    { g: 'Aspectos legales', items: [['leg1', 'Constituida en INAES con autoridades vigentes'], ['leg2', 'Documento que acredita el uso de la planta'], ['leg3', 'Habilitación municipal', 'La inscripción se imprime en cada certificado'], ['leg4', 'Habilitación ambiental como planta de clasificación'], ['leg5', 'Inscripción en ARCA y balances presentados', 'Balance mensual exportable para el contador']] },
    { g: 'Gestión', items: [['ges1', 'Registro de ingresos de material', 'Registros: ingresos'], ['ges2', 'Registro de separado y rechazo', 'Registros: separado y rechazo'], ['ges3', 'Registro de ventas con precio', 'Registros: ventas, con aviso de precio bajo'], ['ges4', 'Control de asistencia y sueldos o retiros', 'Registros: personal del mes'], ['ges5', 'Facturación y cobro a grandes generadores', 'Liquidación mensual y alertas de cobro']] },
    SEG,
    { g: 'Infraestructura y equipamiento', items: [['inf1', 'Galpón techado y acopio bajo techo', 'Los rechazos por humedad muestran lo que se pierde a la intemperie'], ['inf2', 'Baños, vestuarios y comedor'], ['inf3', 'Cinta o mesa de clasificación'], ['inf4', 'Enfardadora'], ['inf5', 'Balanza', 'Sin balanza, se carga por fardos y bolsones'], ['inf6', 'Teléfono o computadora para registrar', 'Alcanza con un teléfono o una computadora']] },
  ],
  empresa: [
    { g: 'Habilitaciones', items: [['hab1', 'Habilitación municipal'], ['hab2', 'Inscripción provincial como planta de tratamiento o acopio'], ['hab3', 'Estudio y declaración de impacto ambiental (Ley 25.612, art. 32)'], ['hab4', 'Seguro ambiental o garantía equivalente (arts. 27 y 38)'], ['hab5', 'Transporte propio habilitado o transportista autorizado']] },
    { g: 'Trazabilidad', items: [['tra1', 'Registro de operaciones permanente (art. 34)', 'Registros de compras, procesado, descarte y ventas'], ['tra2', 'Documento de cada traslado archivado', 'Registros: documentos de traslado'], ['tra3', 'Constancias de reciclado a generadores', 'Constancia anual firmada'], ['tra4', 'Control de stock por material'], ['tra5', 'Precio de compra y de venta controlados', 'Indicadores: margen por kg']] },
    SEG,
    { g: 'Planta', items: [['pl1', 'Balanza de camiones calibrada'], ['pl2', 'Área de acopio techada y separada por material'], ['pl3', 'Equipos de proceso (molino, lavado, prensa)'], ['pl4', 'Plan de mantenimiento', 'Registros: paradas de máquina'], ['pl5', 'Gestión de efluentes y descartes', 'Registros: descarte con su causa']] },
  ],
  municipio: [
    { g: 'Planificación', items: [['pla1', 'Plan GIRSU municipal aprobado'], ['pla2', 'Estudio de generación y composición de residuos', 'Indicadores: kg por habitante y potencial recuperable'], ['pla3', 'Ordenanza de separación en origen'], ['pla4', 'Régimen de grandes generadores', 'Registros: padrón de grandes generadores']] },
    { g: 'Servicio', items: [['ser1', 'Recolección diferenciada en al menos una zona', 'Indicadores: % diferenciada'], ['ser2', 'Puntos verdes o de entrega voluntaria'], ['ser3', 'Planta de clasificación propia o de una cooperativa'], ['ser4', 'Compostaje de orgánicos'], ['ser5', 'Sitio de disposición final habilitado'], ['ser6', 'Puntos limpios para peligrosos domiciliarios', 'Clasificador: qué va al punto limpio'], ['ser7', 'Recolección de poda, voluminosos y control de volquetes', 'Clasificador: servicio para cada residuo']] },
    { g: 'Inclusión', items: [['inc1', 'Censo de recuperadores urbanos', 'Registros: recuperadores'], ['inc2', 'Convenio con cooperativas de reciclaje'], ['inc3', 'Pago por el servicio ambiental de las cooperativas'], ['inc4', 'Elementos de protección para recuperadores']] },
    { g: 'Control y comunicación', items: [['con1', 'Indicadores mensuales del servicio', 'Indicadores de esta plataforma'], ['con2', 'Relevamiento de basurales', 'Registros: basurales'], ['con3', 'Inspección a grandes generadores'], ['con4', 'Programa de educación ambiental', 'Registros: educación ambiental'], ['con5', 'Canal de reclamos para vecinos']] },
  ],
};

export const REG_PROV = { buenos_aires: ['Registro de Tecnologías y Destinos Sustentables', 'Res. OPDS 44/2021'], caba: ['RUR (cooperativas) o habilitación de la APrA (operadores privados)', 'Leyes 992 y 1.854'], entre_rios: ['Registro provincial de operadores de residuos asimilables o industriales no peligrosos', 'Decreto 4.977/09'], santa_fe: ['Registro Provincial de Operadores de Residuos Industriales No Peligrosos', 'Decreto 1.844/02'], cordoba: ['Registro provincial de operadores', 'Ley 9.088 y normas de la Secretaría de Ambiente'] };

export const MAT_CERT = { 'Cartón corrugado': 3.46, 'Papel blanco': 3.15, 'Papel mixto': 3.91, 'PET cristal': 1.15, 'PET verde': 1.15, 'PEAD soplado': 0.84, 'PEBD / film': null, PP: 0.87, PS: null, Vidrio: 0.31, Aluminio: 10.06, 'Chatarra ferrosa': 2.02, 'Tetra Pak': null, RAEE: 0.99, Otros: null };
