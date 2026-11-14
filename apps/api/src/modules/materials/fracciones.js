// Clasificación normativa de los residuos (ver docs/08-marco-normativo.md).

/**
 * Fracciones de residuos domiciliarios y su color: Decreto 779/2022, Anexo II
 * ("Código unificado de colores para la clasificación e identificación de fracciones").
 * `colorVerificado: false` = color tomado de fuentes secundarias; confirmar con el texto
 * oficial del Anexo II (IF-2022-116415878-APN-SCYMA#MAD) antes de imprimir etiquetas.
 */
export const FRACCIONES = {
  secos_valorizables: { nombre: 'Secos valorizables', color: 'verde', hex: '#2e7d32', colorVerificado: true },
  basura: { nombre: 'Basura (no valorizable)', color: 'negro', hex: '#212121', colorVerificado: true },
  organicos: { nombre: 'Orgánicos valorizables', color: 'marrón', hex: '#6d4c41', colorVerificado: true },
  metales: { nombre: 'Metales', color: 'gris', hex: '#757575', colorVerificado: true },
  plasticos: { nombre: 'Plásticos', color: 'amarillo', hex: '#f9a825', colorVerificado: false },
  papel_carton: { nombre: 'Papel y cartón', color: 'azul', hex: '#1565c0', colorVerificado: false },
  vidrio: { nombre: 'Vidrio', color: 'blanco', hex: '#eceff1', colorVerificado: false },
};

/** Residuos especiales de generación universal: Res. 522/2016 (Anexo I, enunciativo) y 189/2019. */
export const SUBTIPOS_REGU = {
  pilas_baterias: 'Pilas y baterías',
  raee: 'Aparatos eléctricos y electrónicos (RAEE)',
  lamparas: 'Lámparas',
  neumaticos: 'Neumáticos fuera de uso',
  aceite_vegetal_usado: 'Aceite vegetal usado',
  otros: 'Otros REGU',
};

/** Etapas de la gestión integral según la Ley 25.916, art. 3. */
export const ETAPAS = ['generacion', 'disposicion_inicial', 'recoleccion', 'transferencia', 'transporte', 'tratamiento', 'disposicion_final'];

/** Fracción por defecto según la categoría operativa del material (para datos existentes e importación). */
export const FRACCION_POR_CATEGORIA = {
  papel_carton: 'papel_carton',
  plasticos: 'plasticos',
  vidrio: 'vidrio',
  metales: 'metales',
  otros: 'secos_valorizables',
};
