// Factores de emisión de referencia para servicios y combustibles.
// Fuentes a verificar con la cooperativa: cada organización puede cargar factores propios.
//
// Electricidad: factor del SIN (Sistema Interconectado Nacional) 2024 — ~0.317 kgCO2e/kWh.
// Gas natural: ~2.0 kgCO2e/m³ (combustión residencial/comercial).
// Gas envasado (GLP): ~1.6 kgCO2e/kg.
// Agua potable: ~0.344 kgCO2e/m³ (incluye bombeo + tratamiento, estimado).
// Nafta: ~2.3 kgCO2e/L. Diésel: ~2.7 kgCO2e/L. GNC: ~2.0 kgCO2e/m³.
// Referencia: GHG Protocol + Factores de Emisión Nacionales (Secretaría de Energía AR).

export const TIPOS_SERVICIO = ['electricidad', 'gas_natural', 'gas_envasado', 'agua'];
export const TIPOS_COMBUSTIBLE = ['nafta', 'diesel', 'gnc', 'electrico'];

export const FACTOR_CO2_SERVICIO = {
  electricidad: { kgCo2PorUnidad: 0.317, unidad: 'kWh', fuente: 'SIN 2024, Secretaría de Energía AR (a verificar)' },
  gas_natural: { kgCo2PorUnidad: 2.0, unidad: 'm³', fuente: 'GHG Protocol (a verificar)' },
  gas_envasado: { kgCo2PorUnidad: 1.6, unidad: 'kg', fuente: 'GHG Protocol (a verificar)' },
  agua: { kgCo2PorUnidad: 0.344, unidad: 'm³', fuente: 'Estimación bombeo + tratamiento (a verificar)' },
};

export const FACTOR_CO2_COMBUSTIBLE = {
  nafta: { kgCo2PorUnidad: 2.3, unidad: 'L', fuente: 'GHG Protocol (a verificar)' },
  diesel: { kgCo2PorUnidad: 2.7, unidad: 'L', fuente: 'GHG Protocol (a verificar)' },
  gnc: { kgCo2PorUnidad: 2.0, unidad: 'm³', fuente: 'GHG Protocol (a verificar)' },
  electrico: { kgCo2PorUnidad: 0.317, unidad: 'kWh', fuente: 'SIN 2024 (usa factor de electricidad)' },
};

export const UNIDAD_SERVICIO = (tipo) => FACTOR_CO2_SERVICIO[tipo]?.unidad;
export const UNIDAD_COMBUSTIBLE = (tipo) => FACTOR_CO2_COMBUSTIBLE[tipo]?.unidad;
