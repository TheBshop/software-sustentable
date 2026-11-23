// Requisitos del certificado de valorización / constancia de reciclado que cada jurisdicción
// exige al operador (cooperativa/recicladora) como prueba de tratamiento para el generador.
// Cuando el generador es un Gran Generador (GG), el certificado emitido por la cooperativa
// es el respaldo que presenta ante su autoridad ambiental provincial o municipal.
//
// Cada régimen define qué campos extras necesita el PDF además de los datos base
// (emisor, receptor, materiales, kg, tratamiento, firma). `camposGenerador` son datos que
// carga el generador (o la cooperativa por él) en la ficha del cliente; `camposOperador`
// son datos de la cooperativa que ya están en Organization o se agregan en Configuración.
//
// verificado: false → tomado de fuentes secundarias; confirmar antes de usar ante una autoridad.

export const REGIMENES_GG = {
  // ─── CABA ───────────────────────────────────────────────────────────────────
  caba: {
    nombre: 'Ciudad Autónoma de Buenos Aires',
    normaGG: 'Ley 1.854 (mod. Ley 4.859), Decreto 128/2014, Res. 83-SSHU/2014',
    autoridad: 'Ministerio de Espacio Público e Higiene Urbana',
    definicion: 'Generadores especiales según actividad y volumen (categorías por resolución)',
    camposGenerador: [
      { campo: 'nroRegistroGG', label: 'N° inscripción Registro Generadores Especiales', requerido: true },
      { campo: 'categoriaGG', label: 'Categoría de generador (I / II / III)', requerido: false },
    ],
    camposOperador: [
      { campo: 'nroHabilitacionDestinoSustentable', label: 'N° habilitación como Destino Sustentable' },
    ],
    camposCertificado: [
      { campo: 'codigoValorizacion', label: 'Código de operación de valorización (R1–R13)' },
      { campo: 'categoriaResiduoCABA', label: 'Categoría de residuo (nomenclador CABA)' },
    ],
    periodoMinimo: 'mensual',
    firmaResponsableTecnico: true,
    normaPie: 'Ley 1.854 (Basura Cero CABA), Decreto 128/2014 y Res. 83-SSHU/2014',
    verificado: false,
  },

  // ─── PROVINCIA DE BUENOS AIRES ──────────────────────────────────────────────
  buenos_aires: {
    nombre: 'Provincia de Buenos Aires',
    normaGG: 'Ley 14.273; Res. OPDS 317/2020 (mod. 331/2023)',
    autoridad: 'Organismo Provincial para el Desarrollo Sostenible (OPDS)',
    definicion: 'Más de 1.000 kg de RSU por mes',
    umbralKgMes: 1000,
    camposGenerador: [
      { campo: 'nroRegistroGG', label: 'N° inscripción Registro OPDS', requerido: true },
      { campo: 'nroHabilitacionEspecial', label: 'N° habilitación especial del generador', requerido: false },
    ],
    camposOperador: [
      { campo: 'nroHabilitacionOPDS', label: 'N° certificado de habilitación especial OPDS' },
    ],
    camposCertificado: [
      { campo: 'codigoValorizacion', label: 'Código de operación (D/R según Basilea)' },
      { campo: 'categoriaYA', label: 'Categorías Y/A del residuo (Ley 11.720)' },
      { campo: 'manifiestos', label: 'N° de manifiestos de transporte vinculados' },
    ],
    periodoMinimo: 'mensual',
    firmaResponsableTecnico: false,
    normaPie: 'Ley 14.273 (Grandes Generadores PBA), Res. OPDS 317/2020',
    verificado: true,
  },

  // ─── CÓRDOBA (capital) ──────────────────────────────────────────────────────
  cordoba: {
    nombre: 'Córdoba',
    normaGG: 'Ord. 12.648 (mod. Ord. 13.228) — Córdoba Capital; Ley 9.088 provincial',
    autoridad: 'Municipalidad de Córdoba (IPA) / Ministerio de Ambiente y Economía Circular',
    definicion: '200 kg o 0,4 m³ diarios o más (Córdoba Capital)',
    umbralKgDia: 200,
    camposGenerador: [
      { campo: 'nroRegistroGG', label: 'N° inscripción Registro IPA / Secretaría de Ambiente', requerido: true },
    ],
    camposOperador: [
      { campo: 'nroRegistroSecretariaAmbiente', label: 'N° registro Secretaría de Ambiente provincial' },
    ],
    camposCertificado: [
      { campo: 'clasificacionResiduo', label: 'Clasificación del residuo (Ley 9.088 / Ley 10.208)' },
      { campo: 'descripcionTratamiento', label: 'Descripción del proceso de tratamiento' },
      { campo: 'balanceMasa', label: 'Balance de masa (ingresado vs. recuperado vs. disposición)' },
    ],
    periodoMinimo: 'mensual',
    firmaResponsableTecnico: true,
    normaPie: 'Ord. 12.648/13.228 (Córdoba Capital), Ley 9.088 y Ley 10.208 (Córdoba)',
    verificado: false,
  },

  // ─── SANTA FE ───────────────────────────────────────────────────────────────
  santa_fe: {
    nombre: 'Santa Fe',
    normaGG: 'Ley 13.055 "Basura Cero"; Ord. 8.335/2008 y 9.463/2015 (Rosario)',
    autoridad: 'Ministerio de Ambiente y Cambio Climático / Municipalidad de Rosario',
    definicion: 'Grandes generadores según ordenanza municipal (Rosario: por categoría de actividad)',
    camposGenerador: [
      { campo: 'nroRegistroGG', label: 'N° inscripción municipal como gran generador', requerido: true },
    ],
    camposOperador: [
      { campo: 'nroHabilitacionProvincial', label: 'N° habilitación provincial como operador' },
    ],
    camposCertificado: [
      { campo: 'codigoValorizacion', label: 'Código de operación de valorización' },
      { campo: 'fraccionResiduos', label: 'Fracción (orgánicos / reciclables / restos)' },
    ],
    periodoMinimo: 'mensual',
    firmaResponsableTecnico: false,
    normaPie: 'Ley 13.055 (Basura Cero Santa Fe); normativa municipal aplicable',
    verificado: false,
  },

  // ─── ENTRE RÍOS ─────────────────────────────────────────────────────────────
  entre_rios: {
    nombre: 'Entre Ríos',
    normaGG: 'Ley 10.311 GIRSU; Ord. 9.233 (Paraná)',
    autoridad: 'Secretaría de Ambiente',
    definicion: 'Según normativa municipal (Paraná remite a normativa específica)',
    camposGenerador: [
      { campo: 'nroRegistroGG', label: 'N° inscripción registro municipal/provincial', requerido: false },
    ],
    camposOperador: [
      { campo: 'nroRegistroAcopio', label: 'N° registro de acopio (Ord. 9.233 art. 28, Paraná)' },
    ],
    camposCertificado: [
      { campo: 'fraccionResiduos', label: 'Fracción (secos / húmedos)' },
    ],
    periodoMinimo: 'anual',
    firmaResponsableTecnico: false,
    normaPie: 'Ley 10.311 (GIRSU Entre Ríos); normativa municipal aplicable',
    verificado: false,
  },

  // ─── MENDOZA ────────────────────────────────────────────────────────────────
  mendoza: {
    nombre: 'Mendoza',
    normaGG: 'Ley 9.659 GIRSU (2025) y su reglamentación',
    autoridad: 'Ministerio de Energía y Ambiente',
    definicion: 'Más de 50 kg diarios de RSU',
    umbralKgDia: 50,
    camposGenerador: [
      { campo: 'nroRegistroGG', label: 'N° inscripción como gran generador (registro provincial)', requerido: true },
    ],
    camposOperador: [
      { campo: 'nroRegistroCentroEC', label: 'N° registro Centro Tecnificado de Economía Circular' },
    ],
    camposCertificado: [
      { campo: 'codigoValorizacion', label: 'Código de operación de valorización' },
    ],
    periodoMinimo: 'mensual',
    firmaResponsableTecnico: false,
    normaPie: 'Ley 9.659 (GIRSU Mendoza) y su reglamentación',
    verificado: false,
  },

  // ─── TUCUMÁN ────────────────────────────────────────────────────────────────
  tucuman: {
    nombre: 'Tucumán',
    normaGG: 'Ley 8.177 GIRSU (2009)',
    autoridad: 'Secretaría de Medio Ambiente',
    definicion: 'Según normativa municipal aplicable',
    camposGenerador: [
      { campo: 'nroRegistroGG', label: 'N° inscripción registro ambiental', requerido: false },
    ],
    camposOperador: [],
    camposCertificado: [],
    periodoMinimo: 'anual',
    firmaResponsableTecnico: false,
    normaPie: 'Ley 8.177 (GIRSU Tucumán)',
    verificado: false,
  },

  // ─── SALTA ──────────────────────────────────────────────────────────────────
  salta: {
    nombre: 'Salta',
    normaGG: 'Ley 7.070 (Título V, Cap. II) y Decreto 1.365/2010',
    autoridad: 'Secretaría de Ambiente',
    definicion: 'Según normativa municipal (art. 105 Ley 7.070)',
    camposGenerador: [
      { campo: 'nroRegistroGG', label: 'N° inscripción registro municipal', requerido: false },
    ],
    camposOperador: [],
    camposCertificado: [],
    periodoMinimo: 'anual',
    firmaResponsableTecnico: false,
    normaPie: 'Ley 7.070 y Decreto 1.365/2010 (Plan GIRSU Salta)',
    verificado: false,
  },

  // ─── CORRIENTES ─────────────────────────────────────────────────────────────
  corrientes: {
    nombre: 'Corrientes',
    normaGG: 'Ley 6.422 (adhesión Ley 25.916)',
    autoridad: 'Instituto Correntino del Agua y del Ambiente (ICAA)',
    definicion: 'Sin régimen específico de GG; aplica marco nacional',
    camposGenerador: [
      { campo: 'nroRegistroGG', label: 'N° inscripción registro ambiental', requerido: false },
    ],
    camposOperador: [],
    camposCertificado: [],
    periodoMinimo: 'anual',
    firmaResponsableTecnico: false,
    normaPie: 'Ley 6.422 (GIRSU Corrientes) y Ley 25.916 nacional',
    verificado: false,
  },

  // ─── CHACO ──────────────────────────────────────────────────────────────────
  chaco: {
    nombre: 'Chaco',
    normaGG: 'Ley 7.034 y Decreto 2.417/2012',
    autoridad: 'Subsecretaría de Ambiente',
    definicion: 'Sin régimen específico de GG; aplica marco nacional',
    camposGenerador: [
      { campo: 'nroRegistroGG', label: 'N° inscripción registro ambiental', requerido: false },
    ],
    camposOperador: [],
    camposCertificado: [],
    periodoMinimo: 'anual',
    firmaResponsableTecnico: false,
    normaPie: 'Ley 7.034 (GIRSU Chaco)',
    verificado: false,
  },

  // ─── MISIONES ───────────────────────────────────────────────────────────────
  misiones: {
    nombre: 'Misiones',
    normaGG: 'Ley XVI N° 89 (ex Ley 4.274)',
    autoridad: 'Ministerio de Cambio Climático',
    definicion: 'Sin régimen específico de GG; aplica marco nacional',
    camposGenerador: [
      { campo: 'nroRegistroGG', label: 'N° inscripción registro ambiental', requerido: false },
    ],
    camposOperador: [],
    camposCertificado: [],
    periodoMinimo: 'anual',
    firmaResponsableTecnico: false,
    normaPie: 'Ley XVI N° 89 (GIRSU Misiones)',
    verificado: false,
  },

  // ─── JUJUY ──────────────────────────────────────────────────────────────────
  jujuy: {
    nombre: 'Jujuy',
    normaGG: 'Ley 5.954 "Pachamama te cuido"',
    autoridad: 'Ministerio de Ambiente y Cambio Climático / GIRSU Jujuy S.E.',
    definicion: 'Sin régimen específico de GG; aplica marco nacional',
    camposGenerador: [
      { campo: 'nroRegistroGG', label: 'N° inscripción registro ambiental', requerido: false },
    ],
    camposOperador: [],
    camposCertificado: [],
    periodoMinimo: 'anual',
    firmaResponsableTecnico: false,
    normaPie: 'Ley 5.954 (GIRSU Jujuy)',
    verificado: false,
  },

  // ─── NEUQUÉN ────────────────────────────────────────────────────────────────
  neuquen: {
    nombre: 'Neuquén',
    normaGG: 'Ley 2.648 (adhesión Ley 25.916)',
    autoridad: 'Secretaría de Ambiente',
    definicion: 'Sin régimen específico de GG; aplica marco nacional',
    camposGenerador: [
      { campo: 'nroRegistroGG', label: 'N° inscripción registro ambiental', requerido: false },
    ],
    camposOperador: [],
    camposCertificado: [],
    periodoMinimo: 'anual',
    firmaResponsableTecnico: false,
    normaPie: 'Ley 2.648 (RSU Neuquén) y Ley 25.916 nacional',
    verificado: false,
  },

  // ─── RÍO NEGRO ─────────────────────────────────────────────────────────────
  rio_negro: {
    nombre: 'Río Negro',
    normaGG: 'Ley 5.491 (2020)',
    autoridad: 'Secretaría de Ambiente y Cambio Climático',
    definicion: 'Sin régimen específico de GG; aplica marco nacional',
    camposGenerador: [
      { campo: 'nroRegistroGG', label: 'N° inscripción registro ambiental', requerido: false },
    ],
    camposOperador: [],
    camposCertificado: [],
    periodoMinimo: 'anual',
    firmaResponsableTecnico: false,
    normaPie: 'Ley 5.491 (GIRSU Río Negro)',
    verificado: false,
  },

  // ─── CHUBUT ─────────────────────────────────────────────────────────────────
  chubut: {
    nombre: 'Chubut',
    normaGG: 'Ley XI N° 50 (2010)',
    autoridad: 'Ministerio de Ambiente y Control del Desarrollo Sustentable',
    definicion: 'Sin régimen específico de GG; aplica marco nacional',
    camposGenerador: [
      { campo: 'nroRegistroGG', label: 'N° inscripción registro ambiental', requerido: false },
    ],
    camposOperador: [],
    camposCertificado: [],
    periodoMinimo: 'anual',
    firmaResponsableTecnico: false,
    normaPie: 'Ley XI N° 50 (GIRSU Chubut)',
    verificado: false,
  },

  // ─── LA PAMPA ───────────────────────────────────────────────────────────────
  la_pampa: {
    nombre: 'La Pampa',
    normaGG: 'Sin ley provincial GIRSU vigente; competencia municipal',
    autoridad: 'Secretaría de Ambiente',
    definicion: 'Sin régimen específico; aplica marco nacional',
    camposGenerador: [
      { campo: 'nroRegistroGG', label: 'N° inscripción registro ambiental', requerido: false },
    ],
    camposOperador: [],
    camposCertificado: [],
    periodoMinimo: 'anual',
    firmaResponsableTecnico: false,
    normaPie: 'Ley 25.916 nacional (no hay ley provincial GIRSU vigente)',
    verificado: false,
  },

  // ─── SAN JUAN ───────────────────────────────────────────────────────────────
  san_juan: {
    nombre: 'San Juan',
    normaGG: 'Ley 8.238 / Ley 1114-L (Sistema GIRSU provincial)',
    autoridad: 'Secretaría de Ambiente y Desarrollo Sustentable',
    definicion: 'Sin régimen específico de GG; aplica marco nacional',
    camposGenerador: [
      { campo: 'nroRegistroGG', label: 'N° inscripción registro ambiental', requerido: false },
    ],
    camposOperador: [],
    camposCertificado: [],
    periodoMinimo: 'anual',
    firmaResponsableTecnico: false,
    normaPie: 'Ley 8.238 (GIRSU San Juan)',
    verificado: false,
  },

  // ─── SAN LUIS ───────────────────────────────────────────────────────────────
  san_luis: {
    nombre: 'San Luis',
    normaGG: 'Ley IX-0873-2013 (GIRSU)',
    autoridad: 'Secretaría de Ambiente',
    definicion: 'Sin régimen específico de GG; aplica marco nacional',
    camposGenerador: [
      { campo: 'nroRegistroGG', label: 'N° inscripción registro ambiental', requerido: false },
    ],
    camposOperador: [],
    camposCertificado: [],
    periodoMinimo: 'anual',
    firmaResponsableTecnico: false,
    normaPie: 'Ley IX-0873-2013 (GIRSU San Luis)',
    verificado: false,
  },

  // ─── CATAMARCA ──────────────────────────────────────────────────────────────
  catamarca: {
    nombre: 'Catamarca',
    normaGG: 'Ley 5.558 (Presupuestos mínimos ambientales)',
    autoridad: 'Secretaría de Ambiente',
    definicion: 'Sin régimen específico de GG; aplica marco nacional',
    camposGenerador: [
      { campo: 'nroRegistroGG', label: 'N° inscripción registro ambiental', requerido: false },
    ],
    camposOperador: [],
    camposCertificado: [],
    periodoMinimo: 'anual',
    firmaResponsableTecnico: false,
    normaPie: 'Ley 5.558 (Catamarca) y Ley 25.916 nacional',
    verificado: false,
  },

  // ─── LA RIOJA ───────────────────────────────────────────────────────────────
  la_rioja: {
    nombre: 'La Rioja',
    normaGG: 'Ley 7.801 (Ambiente) y normativa municipal',
    autoridad: 'Secretaría de Ambiente',
    definicion: 'Sin régimen específico de GG; aplica marco nacional',
    camposGenerador: [
      { campo: 'nroRegistroGG', label: 'N° inscripción registro ambiental', requerido: false },
    ],
    camposOperador: [],
    camposCertificado: [],
    periodoMinimo: 'anual',
    firmaResponsableTecnico: false,
    normaPie: 'Ley 7.801 (La Rioja) y Ley 25.916 nacional',
    verificado: false,
  },

  // ─── SANTIAGO DEL ESTERO ────────────────────────────────────────────────────
  santiago_del_estero: {
    nombre: 'Santiago del Estero',
    normaGG: 'Ley 6.321 (Ambiente)',
    autoridad: 'Secretaría de Medio Ambiente',
    definicion: 'Sin régimen específico de GG; aplica marco nacional',
    camposGenerador: [
      { campo: 'nroRegistroGG', label: 'N° inscripción registro ambiental', requerido: false },
    ],
    camposOperador: [],
    camposCertificado: [],
    periodoMinimo: 'anual',
    firmaResponsableTecnico: false,
    normaPie: 'Ley 6.321 (Santiago del Estero) y Ley 25.916 nacional',
    verificado: false,
  },

  // ─── FORMOSA ────────────────────────────────────────────────────────────────
  formosa: {
    nombre: 'Formosa',
    normaGG: 'Ley 1.060 (Ambiente)',
    autoridad: 'Subsecretaría de Recursos Naturales',
    definicion: 'Sin régimen específico de GG; aplica marco nacional',
    camposGenerador: [
      { campo: 'nroRegistroGG', label: 'N° inscripción registro ambiental', requerido: false },
    ],
    camposOperador: [],
    camposCertificado: [],
    periodoMinimo: 'anual',
    firmaResponsableTecnico: false,
    normaPie: 'Ley 1.060 (Formosa) y Ley 25.916 nacional',
    verificado: false,
  },

  // ─── SANTA CRUZ ─────────────────────────────────────────────────────────────
  santa_cruz: {
    nombre: 'Santa Cruz',
    normaGG: 'Ley 2.567 (Ambiente)',
    autoridad: 'Secretaría de Ambiente',
    definicion: 'Sin régimen específico de GG; aplica marco nacional',
    camposGenerador: [
      { campo: 'nroRegistroGG', label: 'N° inscripción registro ambiental', requerido: false },
    ],
    camposOperador: [],
    camposCertificado: [],
    periodoMinimo: 'anual',
    firmaResponsableTecnico: false,
    normaPie: 'Ley 2.567 (Santa Cruz) y Ley 25.916 nacional',
    verificado: false,
  },

  // ─── TIERRA DEL FUEGO ──────────────────────────────────────────────────────
  tierra_del_fuego: {
    nombre: 'Tierra del Fuego, Antártida e Islas del Atlántico Sur',
    normaGG: 'Ley 55 (Residuos) y normativa municipal',
    autoridad: 'Secretaría de Ambiente, Desarrollo Sostenible y Cambio Climático',
    definicion: 'Sin régimen específico de GG; aplica marco nacional',
    camposGenerador: [
      { campo: 'nroRegistroGG', label: 'N° inscripción registro ambiental', requerido: false },
    ],
    camposOperador: [],
    camposCertificado: [],
    periodoMinimo: 'anual',
    firmaResponsableTecnico: false,
    normaPie: 'Ley 55 (Tierra del Fuego) y Ley 25.916 nacional',
    verificado: false,
  },
};

export const CODIGOS_VALORIZACION = {
  R1: 'Utilización como combustible',
  R2: 'Recuperación de disolventes',
  R3: 'Reciclado de sustancias orgánicas no utilizadas como disolventes',
  R4: 'Reciclado de metales y compuestos metálicos',
  R5: 'Reciclado de otras materias inorgánicas',
  R6: 'Regeneración de ácidos o bases',
  R7: 'Valorización de componentes utilizados para reducir la contaminación',
  R8: 'Valorización de componentes provenientes de catalizadores',
  R9: 'Regeneración u otra reutilización de aceites',
  R10: 'Tratamiento de suelos',
  R11: 'Uso de residuos de las operaciones R1 a R10',
  R12: 'Intercambio para las operaciones R1 a R11',
  R13: 'Acumulación para las operaciones R1 a R12',
};

export function regimenParaJurisdiccion(provincia) {
  return REGIMENES_GG[provincia] ?? null;
}
