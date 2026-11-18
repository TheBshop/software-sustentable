// Factores de emisión: SNIGEI-AR 2025 (huella) y EPA WARM v16 (emisiones evitadas).
// Generado desde la página (nueva-vida-propuesta.html). Fuente única de estos datos para la API y la web.


export const FUENTE_FE = 'Subsecretaría de Ambiente de la Nación, "Factores de Emisión GEI. Datos del SNIGEI-AR aplicables al cálculo de Huella de Carbono" (2025)';

export const URL_FE = 'https://inventariogei.ambiente.gob.ar/files/Factores_de_Emision_SNIGEIAR_para_HC_2025.pdf';

export const PCG = { ch4: 28, n2o: 265 }; // AR5 (IPCC), los que usa el documento

export const FE = {
  Gasoil: { u: 'L', co2: 2.3390, ch4: 0.00013664, n2o: 0.00013664, bio: 0.1716, ref: 'Gas oil Grado 2 (Común) blend 7,5 % · Tabla 2' },
  Nafta: { u: 'L', co2: 1.9693, ch4: 0.0009567, n2o: 0.000093756, bio: 0.1795, ref: 'Nafta Grado 2 (Súper) con bioetanol 12 % · Tabla 2' },
  GNC: { u: 'm³', co2: 1.95133, ch4: 0.0031955, n2o: 0.0001079, bio: 0, ref: 'GNC · Tabla 3' },
  Electricidad: { u: 'kWh', co2: 0.283, ch4: 0.0000167, n2o: 0.0000097, bio: 0, ref: 'Uso de electricidad, año 2022 (último publicado) · Tabla 5' },
};

export const feCO2e = (f) => f.co2 + f.ch4 * PCG.ch4 + f.n2o * PCG.n2o;

export const FUENTE_WARM = 'US EPA, WARM versión 16 (diciembre 2023), Exhibit 2-2: Emission Factor for Recycling';

export const URL_WARM = 'https://www.epa.gov/system/files/documents/2024-01/warm_management_practices_v16_dec.pdf';

export const TC = 0.907185; // t métricas por tonelada corta

export const WARM = {
  corrugado: ['Corrugated Containers', 3.14, 3.06], papelMixto: ['Mixed Paper (general)', 3.55, 3.06], papelOficina: ['Office Paper', 2.86, 3.06],
  pet: ['PET', 1.04, 0], pead: ['HDPE', 0.76, 0], pp: ['PP', 0.79, 0], plasticos: ['Mixed Plastics', 0.93, 0],
  vidrio: ['Glass', 0.28, 0], aluminio: ['Aluminum Cans', 9.13, 0], acero: ['Steel Cans', 1.83, 0],
};

export const MAT_WARM = { Cartón: 'corrugado', Papel: 'papelMixto', PET: 'pet', PEAD: 'pead', PP: 'pp', Vidrio: 'vidrio', Aluminio: 'aluminio', Chatarra: 'acero' };

export const fWarm = (mat) => { const w = WARM[MAT_WARM[mat]]; return w ? { kg: w[1] / TC, bosque: w[2] / TC, nombre: w[0], st: w[1] } : null; };
