// Espejo de apps/api/src/modules/materials/fracciones.js para la interfaz.
// Fracciones y colores: Decreto 779/2022, Anexo II. `colorVerificado: false` = a confirmar con el texto oficial.
export const FRACCIONES = {
  secos_valorizables: { nombre: 'Secos valorizables', color: 'verde', hex: '#2e7d32' },
  basura: { nombre: 'Basura (no valorizable)', color: 'negro', hex: '#212121' },
  organicos: { nombre: 'Orgánicos valorizables', color: 'marrón', hex: '#6d4c41' },
  metales: { nombre: 'Metales', color: 'gris', hex: '#757575' },
  plasticos: { nombre: 'Plásticos', color: 'amarillo', hex: '#f9a825', colorVerificado: false },
  papel_carton: { nombre: 'Papel y cartón', color: 'azul', hex: '#1565c0', colorVerificado: false },
  vidrio: { nombre: 'Vidrio', color: 'blanco', hex: '#eceff1', colorVerificado: false },
};

export const CORRIENTES = {
  rsu: 'Residuos urbanos (RSU)',
  regu: 'Residuo especial (REGU)',
  peligroso: 'Peligroso (Ley 24.051)',
  industrial: 'Industrial (Ley 25.612)',
  fitosanitario: 'Envases fitosanitarios (Ley 27.279)',
};

export const SUBTIPOS_REGU = {
  pilas_baterias: 'Pilas y baterías',
  baterias_vehiculos: 'Baterías de vehículos',
  raee: 'Aparatos eléctricos y electrónicos (RAEE)',
  lamparas: 'Lámparas (fluorescentes, de bajo consumo, incandescentes)',
  neumaticos: 'Neumáticos fuera de uso',
  aceite_vegetal_usado: 'Aceite vegetal usado',
  aceite_mineral_usado: 'Aceite mineral usado de automotores',
  medicamentos: 'Restos de medicamentos',
  termometros: 'Termómetros',
  quimicos_domiciliarios: 'Pinturas, solventes, barnices y similares',
  higiene_personal: 'Pañales y elementos de higiene personal',
  otros: 'Otros REGU',
};

/** Chip con el color de la fracción (o de la corriente si no es RSU). */
export function FraccionChip({ fraccion, corriente }) {
  const f = FRACCIONES[fraccion];
  const texto = f ? f.nombre : CORRIENTES[corriente] ?? corriente ?? '—';
  return (
    <span className="fraccion">
      <span className="dot" style={{ background: f?.hex ?? '#90a4ae' }} aria-hidden="true" />
      {texto}
    </span>
  );
}
