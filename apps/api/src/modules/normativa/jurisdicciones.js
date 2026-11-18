// Marco normativo de residuos por jurisdicción (nación, provincias y municipios de los
// prototipos). Investigado en noviembre de 2026; ver docs/10-normativa-por-jurisdiccion.md.
//
// `verificado: true`  → confirmado contra el texto oficial o un organismo público.
// `verificado: false` → surge de fuentes secundarias (prensa, compilaciones): confirmar el
//                        texto vigente antes de usarlo frente a un cliente o una autoridad.
//
// `aplica` vincula cada norma con las funciones del sistema que ayudan a cumplirla:
//   certificado, informe_anual, calidad_separacion, regu, peligrosos_bloqueados,
//   libro_movimientos, constancia_reciclado, registro_operador, seguridad_personal,
//   grandes_generadores, recuperadores, tratamiento

export const NACIONAL = [
  { norma: 'Ley 25.675', tema: 'Ley General del Ambiente', resumen: 'Presupuestos mínimos ambientales; principios de prevención y responsabilidad.', aplica: [], verificado: true },
  { norma: 'Ley 25.916 y Decreto 779/2022', tema: 'Residuos domiciliarios (RSU)', resumen: 'Etapas de la gestión integral, jerarquía de opciones, trazabilidad por etapa y código de colores por fracción (Anexo II del decreto).', aplica: ['certificado', 'libro_movimientos', 'informe_anual', 'calidad_separacion'], verificado: true },
  { norma: 'Ley 25.612', tema: 'Residuos industriales y de servicios', resumen: 'Responsabilidad del generador hasta que el residuo se usa como insumo; declaración jurada firmada por quien recicla; registro de operaciones de las plantas. Art. 60 (derogación de la 24.051) vetado.', aplica: ['tratamiento', 'constancia_reciclado', 'libro_movimientos'], fuente: 'https://www.argentina.gob.ar/normativa/nacional/norma-76349/texto', verificado: true },
  { norma: 'Ley 24.051', tema: 'Residuos peligrosos', resumen: 'Registro de generadores, transportistas y operadores, y manifiesto por traslado. Una cooperativa sin inscripción no puede recibirlos.', aplica: ['peligrosos_bloqueados'], verificado: true },
  { norma: 'Res. 522/2016 y 189/2019 (ex MAyDS)', tema: 'Residuos especiales de generación universal (REGU)', resumen: 'Pilas, RAEE, neumáticos, aceite vegetal usado y otros: corriente separada de los RSU, con sistemas de gestión propios.', aplica: ['regu'], verificado: false },
  { norma: 'Ley 27.279', tema: 'Envases vacíos de fitosanitarios', resumen: 'Sistema de gestión con centros de almacenamiento transitorio. Corriente propia: no se mezcla con plásticos urbanos.', aplica: ['regu'], verificado: true },
];

/** Provincias (clave) → leyes, grandes generadores y municipios con normativa propia. */
export const PROVINCIAS = {
  caba: {
    nombre: 'Ciudad Autónoma de Buenos Aires',
    autoridad: 'Ministerio de Espacio Público e Higiene Urbana (GCBA)',
    leyes: [
      { norma: 'Ley 1.854 "Basura Cero" (texto consolidado por Ley 6.347)', tema: 'RSU', resumen: 'Reducción progresiva de la disposición final; separación en origen; inclusión de recuperadores urbanos.', aplica: ['calidad_separacion', 'informe_anual', 'recuperadores'], fuente: 'https://buenosaires.gob.ar/sites/default/files/2024-02/Ley-1854-consolidada-2023.pdf', verificado: true },
    ],
    grandesGeneradores: {
      norma: 'Ley 1.854 (mod. Ley 4.859), Decreto 128/2014, Res. 83-SSHU/2014, Res. 454-MEPHUGC/2021, Res. 47-SSHU/2020',
      definicion: 'Generadores especiales según actividad y volumen, con categorías fijadas por resolución.',
      obligaciones: ['Inscribirse en el Registro de Generadores Especiales', 'Separar en origen (secos, orgánicos/húmedos)', 'Presentar el plan anual de manejo de residuos y la declaración jurada (plataforma TAD)'],
      verificado: false,
    },
  },
  buenos_aires: {
    nombre: 'Provincia de Buenos Aires',
    autoridad: 'Ministerio de Ambiente (Dirección Provincial de Residuos Sólidos Urbanos)',
    leyes: [
      { norma: 'Ley 13.592', tema: 'RSU', resumen: 'Gestión integral de RSU; planes municipales (GIRSU).', aplica: ['informe_anual'], fuente: 'https://normas.gba.gob.ar/ar-b/ley/2006/13592/3282', verificado: true },
      { norma: 'Ley 14.321', tema: 'RAEE', resumen: 'Gestión de residuos de aparatos eléctricos y electrónicos.', aplica: ['regu'], fuente: 'https://www.ambiente.gba.gob.ar/sites/default/files/LEY%2014321.pdf', verificado: true },
    ],
    grandesGeneradores: {
      norma: 'Ley 14.273; Res. OPDS 317/2020 (mod. Res. 331/2023); Res. OPDS 139/2013 (industrias del AMBA)',
      definicion: 'Generador especial: más de 1.000 kg de residuos por mes.',
      umbralKgMes: 1000,
      obligaciones: ['Plan de gestión integral e inclusiva de RSU: separación en origen, recolección diferenciada, transporte, tratamiento y disposición final', 'Hacerse cargo de los costos de transporte y disposición (Ley 14.273)'],
      verificado: true,
      fuente: 'https://normas.gba.gob.ar/ar-b/resolucion/2020/317/219168',
    },
    municipios: {
      san_nicolas: { nombre: 'San Nicolás de los Arroyos', normas: [{ norma: 'Ordenanza 10.318/2021', tema: 'Medianos generadores', resumen: 'Régimen para medianos generadores de residuos.', aplica: ['grandes_generadores'], fuente: 'https://www.sannicolasciudad.gob.ar/system/procedure_attachments/files/000/000/369/original/Ordenanza_10318-21__Medianos_generadores.pdf', verificado: false }] },
    },
  },
  cordoba: {
    nombre: 'Córdoba',
    autoridad: 'Ministerio de Ambiente y Economía Circular',
    leyes: [
      { norma: 'Ley 9.088', tema: 'RSU y asimilables', resumen: 'Generación, transporte, tratamiento y disposición de RSU; prohíbe el vertido incontrolado.', aplica: ['libro_movimientos'], fuente: 'https://www.cba.gov.ar/wp-content/4p96humuzp/2017/04/Gesti%c3%b3n-de-Residuos-S%c3%b3lidos-Urbanos-y-Residuos-Asimilables-Ley-9088.pdf', verificado: true },
      { norma: 'Ley 7.343', tema: 'Ambiente', resumen: 'Principios rectores de preservación del ambiente.', aplica: [], fuente: 'https://www.cba.gov.ar/wp-content/4p96humuzp/2017/04/Principios-Rectores-para-la-Preservaci%C3%B3n-y-Mejoramiento-del-Ambiente.-Ley-7343.pdf', verificado: true },
    ],
    municipios: {
      cordoba: {
        nombre: 'Córdoba Capital',
        normas: [{ norma: 'Ordenanza 12.648 (mod. Ord. 13.228)', tema: 'Grandes generadores', resumen: 'Registro y certificado de grandes generadores (IPA); plan de gestión con separación de fracciones avalado por profesional; transporte autorizado; renovación cada 5 años.', aplica: ['grandes_generadores', 'certificado', 'calidad_separacion'], verificado: false }],
        grandesGeneradores: { definicion: 'Comercios e industrias con 200 kg o 0,4 m³ diarios o más (otras fuentes citan 0,25 m³: verificar).', umbralKgDia: 200, verificado: false },
      },
    },
  },
  santa_fe: {
    nombre: 'Santa Fe',
    autoridad: 'Ministerio de Ambiente y Cambio Climático',
    leyes: [
      { norma: 'Ley 13.055 "Basura Cero"', tema: 'RSU', resumen: 'Reducción progresiva de la disposición final; consorcios regionales; cierre de basurales.', aplica: ['informe_anual', 'calidad_separacion'], verificado: false },
      { norma: 'Ley 13.940', tema: 'RAEE', resumen: 'Gestión de residuos de aparatos eléctricos y electrónicos.', aplica: ['regu'], verificado: false },
    ],
    municipios: {
      rosario: { nombre: 'Rosario', normas: [{ norma: 'Ordenanza 8.335/2008 (Basura Cero); Ord. 7.007/2003, 7.600/2003 y 9.463/2015', tema: 'Basura Cero y grandes generadores', resumen: 'Categoría de grandes generadores; meta municipal: 100 % de los grandes generadores separando en tres fracciones (orgánicos, reciclables, restos) para 2030. Hay una reforma en el Concejo.', aplica: ['grandes_generadores', 'calidad_separacion'], verificado: false }] },
    },
  },
  entre_rios: {
    nombre: 'Entre Ríos',
    autoridad: 'Secretaría de Ambiente',
    leyes: [{ norma: 'Ley 10.311', tema: 'GIRSU', resumen: 'Prioriza la reducción en origen y la clasificación domiciliaria.', aplica: ['calidad_separacion'], verificado: false }],
    municipios: {
      parana: { nombre: 'Paraná', normas: [{ norma: 'Ordenanza 9.233 (mod. Ord. 9.931)', tema: 'GIRSU municipal', resumen: 'Separación secos/húmedos obligatoria (art. 10), gestión diferenciada (art. 5), registro de acopios (art. 28), protección del personal (art. 21), inclusión de recuperadores (arts. 34-35). Grandes generadores: remite a normativa específica.', aplica: ['calidad_separacion', 'regu', 'registro_operador', 'seguridad_personal', 'recuperadores'], fuente: 'https://digesto.parana.gob.ar/norma/6029', verificado: true }] },
    },
  },
  la_pampa: {
    nombre: 'La Pampa',
    autoridad: 'Secretaría de Ambiente',
    leyes: [],
    nota: 'No se encontró una ley provincial GIRSU vigente: la gestión de RSU es competencia municipal. Hay un proyecto de Sistema Provincial GIRSU en trámite.',
  },
  mendoza: {
    nombre: 'Mendoza',
    autoridad: 'Ministerio de Energía y Ambiente',
    leyes: [{ norma: 'Ley 9.659 GIRSU (2025, reglamentada en 2026; deroga la Ley 5.970)', tema: 'RSU', resumen: 'Plan provincial con cuatro regiones; planes municipales obligatorios; Registro Provincial de Transportistas de RSU y Registro de Centros Tecnificados de Economía Circular.', aplica: ['registro_operador', 'informe_anual', 'grandes_generadores'], verificado: false }],
    grandesGeneradores: { norma: 'Reglamentación de la Ley 9.659', definicion: 'Grandes generadores: más de 50 kg diarios de RSU.', umbralKgDia: 50, obligaciones: ['Gestión diferenciada según el plan municipal'], verificado: false },
  },
  san_juan: {
    nombre: 'San Juan',
    autoridad: 'Secretaría de Ambiente y Desarrollo Sustentable',
    leyes: [{ norma: 'Ley 8.238 (2011) / Ley 1114-L', tema: 'Sistema GIRSU provincial', resumen: 'Interés público de la GIRSU (PEGIRSU). El Parque de Tecnologías Ambientales recibe cerca del 80 % de los residuos de la provincia; los municipios pagan una tasa de disposición.', aplica: ['informe_anual'], verificado: false }],
  },
  san_luis: {
    nombre: 'San Luis',
    autoridad: 'Secretaría de Ambiente',
    leyes: [
      { norma: 'Ley IX-0873-2013', tema: 'GIRSU', resumen: 'Sistema provincial de gestión integral de RSU; los municipios gestionan y dictan normas complementarias.', aplica: ['informe_anual'], verificado: false },
      { norma: 'Ley IX-0335-2004 y Decreto 2092/2006', tema: 'Residuos peligrosos', resumen: 'Adhesión a la Ley 24.051.', aplica: ['peligrosos_bloqueados'], verificado: false },
    ],
  },
  tucuman: {
    nombre: 'Tucumán',
    autoridad: 'Secretaría de Medio Ambiente',
    leyes: [{ norma: 'Ley 8.177 (2009)', tema: 'GIRSU', resumen: 'Gestión integral de RSU y Consorcio Público Metropolitano (siete municipios del Gran Tucumán).', aplica: ['informe_anual'], verificado: false }],
  },
  salta: {
    nombre: 'Salta',
    autoridad: 'Secretaría de Ambiente',
    leyes: [
      { norma: 'Ley 7.070', tema: 'Protección del ambiente (Título V, Cap. II: residuos)', resumen: 'Los municipios regulan los residuos que se generan en su territorio (art. 105).', aplica: [], verificado: false },
      { norma: 'Decreto 1.365/2010', tema: 'Plan Provincial GIRSU', resumen: 'Aprueba el Plan Provincial de Gestión Integral de RSU.', aplica: ['informe_anual'], verificado: false },
    ],
  },
  corrientes: {
    nombre: 'Corrientes',
    autoridad: 'Instituto Correntino del Agua y del Ambiente (ICAA)',
    leyes: [{ norma: 'Ley 6.422 (2017)', tema: 'RSU', resumen: 'Adhiere a la Ley 25.916 y adopta sus etapas de gestión integral.', aplica: ['libro_movimientos'], fuente: 'https://icaa.gov.ar/wp-content/uploads/2025/06/Ley6422.pdf', verificado: true }],
  },
  chaco: {
    nombre: 'Chaco',
    autoridad: 'Subsecretaría de Ambiente',
    leyes: [{ norma: 'Ley 7.034 (2012) y Decreto 2.417/2012', tema: 'GIRSU', resumen: 'Erradicar basurales; programas municipales de gestión integral presentados ante la autoridad provincial.', aplica: ['informe_anual'], fuente: 'https://argentina.gob.ar/sites/default/files/rsu-chaco-ley-7034.pdf', verificado: true }],
  },
  misiones: {
    nombre: 'Misiones',
    autoridad: 'Ministerio de Ecología y Recursos Naturales Renovables / Ministerio de Cambio Climático',
    leyes: [
      { norma: 'Ley XVI N° 89 (antes Ley 4.274)', tema: 'GIRSU', resumen: 'Exigencias básicas de la gestión integral conforme a la Ley 25.916; prohíbe la quema.', aplica: ['libro_movimientos'], fuente: 'https://www.diputadosmisiones.gov.ar/nuevo/archivos/digesto/leyes/619.pdf', verificado: true },
      { norma: 'Ley XVI N° 133 (2020)', tema: 'RAEE y neumáticos', resumen: 'Sistema provincial para residuos eléctricos, electrónicos y neumáticos fuera de uso.', aplica: ['regu'], verificado: false },
    ],
  },
  jujuy: {
    nombre: 'Jujuy',
    autoridad: 'Ministerio de Ambiente y Cambio Climático; GIRSU Jujuy S.E.',
    leyes: [{ norma: 'Ley 5.954 (2016, modificada)', tema: 'GIRSU "Pachamama te cuido"', resumen: 'Crea GIRSU Jujuy S.E. y el Consejo Provincial GIRSU. Los municipios que adhieren transfieren el derecho sobre los residuos a la empresa; habilita la tasa GIRSU.', aplica: ['informe_anual'], verificado: false }],
  },
  neuquen: {
    nombre: 'Neuquén',
    autoridad: 'Secretaría de Ambiente',
    leyes: [
      { norma: 'Ley 2.648 (2009)', tema: 'RSU', resumen: 'Adhesión a la Ley 25.916.', aplica: [], verificado: false },
      { norma: 'Ley 1.875 (mod. Ley 2.267) y Decreto 2.656/1999', tema: 'Ambiente y residuos', resumen: 'Marco ambiental provincial anterior.', aplica: [], verificado: false },
    ],
    nota: 'No se encontró una ley provincial específica de RAEE: la recolección de electrónicos la organiza cada municipio.',
  },
  chubut: {
    nombre: 'Chubut',
    autoridad: 'Ministerio de Ambiente y Control del Desarrollo Sustentable',
    leyes: [{ norma: 'Ley XI N° 50 (2010) y Decreto 49/2015', tema: 'GIRSU', resumen: 'Exigencias básicas de la gestión integral de RSU; prohíbe la disposición a cielo abierto; los municipios dictan normas complementarias.', aplica: ['informe_anual'], verificado: false }],
  },
  rio_negro: {
    nombre: 'Río Negro',
    autoridad: 'Secretaría de Ambiente y Cambio Climático',
    leyes: [{ norma: 'Ley 5.491 (2020)', tema: 'GIRSU', resumen: 'Plan Provincial GIRSU, planes municipales para erradicar basurales, regionalización (consorcios) y fondo específico.', aplica: ['informe_anual'], fuente: 'https://web.legisrn.gov.ar/legislativa/legislacion/documento?id=10386', verificado: true }],
  },
};

/** Marco normativo completo de una jurisdicción: nación + provincia + municipio. */
export function marcoNormativo({ provincia, municipio } = {}) {
  const p = PROVINCIAS[provincia];
  const m = p?.municipios?.[municipio];
  return {
    jurisdiccion: { provincia: p?.nombre ?? null, municipio: m?.nombre ?? null, autoridad: p?.autoridad ?? null },
    nacional: NACIONAL,
    provincial: p?.leyes ?? [],
    municipal: m?.normas ?? [],
    grandesGeneradores: m?.grandesGeneradores ?? p?.grandesGeneradores ?? null,
    notas: [p?.nota].filter(Boolean),
  };
}
