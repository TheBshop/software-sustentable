// Catálogo base de materiales para armar el sistema de una organización nueva.
// Cada prototipo toma de acá los materiales que la entidad recibe.
//
// Los pesos por unidad y los factores de CO2 son VALORES DE EJEMPLO: cada organización tiene
// que pesar sus propios fardos y bolsones y cargar la fuente de sus factores.
// Precios de referencia: Reaquila (revisión 30/10/2026), solo donde había dato.

const REAQUILA = { fuente: 'Reaquila, precios de materiales reciclados (revisión 30/10/2026)', fecha: new Date('2026-10-30') };
const ref = (minKg, maxKg) => ({ precioReferencia: { minKg, maxKg, ...REAQUILA } });
const FUENTE_EJEMPLO = 'Valor de ejemplo, falta definir la fuente';

export const CATALOGO = {
  CART: { nombre: 'Cartón corrugado', categoria: 'papel_carton', factorCo2: 0.9, unidades: [{ nombre: 'fardo', kg: 60 }, { nombre: 'bolsón', kg: 25 }], ...ref(120, 240) },
  PAP: { nombre: 'Papel blanco', categoria: 'papel_carton', factorCo2: 0.9, unidades: [{ nombre: 'bolsón', kg: 30 }], ...ref(120, 370) },
  PAPM: { nombre: 'Papel mixto / de archivo', categoria: 'papel_carton', factorCo2: 0.8, unidades: [{ nombre: 'bolsón', kg: 30 }, { nombre: 'caja de archivo', kg: 12 }] },
  TETRA: { nombre: 'Envases multicapa (Tetra Pak)', categoria: 'otros', fraccion: 'secos_valorizables', factorCo2: 0.5, unidades: [{ nombre: 'bolsón', kg: 15 }] },
  PET: { nombre: 'PET (botellas)', categoria: 'plasticos', factorCo2: 1.5, unidades: [{ nombre: 'bolsón', kg: 12 }, { nombre: 'fardo', kg: 80 }], ...ref(250, 560) },
  PEAD: { nombre: 'PEAD (bidones, soplado)', categoria: 'plasticos', factorCo2: 1.2, unidades: [{ nombre: 'bolsón', kg: 15 }], ...ref(250, 850) },
  PEBD: { nombre: 'PEBD / film stretch', categoria: 'plasticos', factorCo2: 1.1, unidades: [{ nombre: 'bolsón', kg: 20 }, { nombre: 'fardo', kg: 70 }] },
  PP: { nombre: 'Polipropileno (PP)', categoria: 'plasticos', factorCo2: 1.2, unidades: [{ nombre: 'bolsón', kg: 15 }] },
  PS: { nombre: 'Poliestireno (PS, telgopor limpio)', categoria: 'plasticos', factorCo2: 1.3, unidades: [{ nombre: 'bolsón', kg: 3 }] },
  BAZAR: { nombre: 'Plástico rígido mixto (bazar)', categoria: 'plasticos', factorCo2: 1.0, unidades: [{ nombre: 'bolsón', kg: 20 }] },
  TAPAS: { nombre: 'Tapitas plásticas', categoria: 'plasticos', factorCo2: 1.2, unidades: [{ nombre: 'bolsa', kg: 5 }] },
  PLAGR: { nombre: 'Plásticos agrícolas (silobolsas, mulching)', categoria: 'plasticos', factorCo2: 1.0, unidades: [{ nombre: 'fardo', kg: 100 }] },
  REZPL: { nombre: 'Rezago plástico industrial (inyección, scrap)', categoria: 'plasticos', corriente: 'industrial', factorCo2: 1.2, unidades: [{ nombre: 'bolsón', kg: 400 }] },
  VID: { nombre: 'Vidrio', categoria: 'vidrio', factorCo2: 0.3, unidades: [{ nombre: 'tambor', kg: 90 }], ...ref(50, 85) },
  ALU: { nombre: 'Aluminio (latas)', categoria: 'metales', factorCo2: 9, unidades: [{ nombre: 'bolsón', kg: 8 }], ...ref(1500, 3500) },
  CHAT: { nombre: 'Chatarra ferrosa', categoria: 'metales', factorCo2: 1.5, ...ref(100, 250) },
  METNF: { nombre: 'Metales no ferrosos (cobre, bronce)', categoria: 'metales', factorCo2: 3.5 },
  CAPS: { nombre: 'Cápsulas de café', categoria: 'otros', fraccion: 'secos_valorizables', factorCo2: 2, unidades: [{ nombre: 'bolsa', kg: 4 }] },
  TEXT: { nombre: 'Textiles', categoria: 'otros', fraccion: 'secos_valorizables', factorCo2: 3, unidades: [{ nombre: 'bolsón', kg: 25 }] },
  VOLU: { nombre: 'Voluminosos secos', categoria: 'otros', fraccion: 'secos_valorizables', factorCo2: 0.5 },
  ORG: { nombre: 'Orgánicos para compostaje', categoria: 'otros', fraccion: 'organicos', factorCo2: 0.5, unidades: [{ nombre: 'tacho', kg: 40 }] },
  RAEE: { nombre: 'Aparatos eléctricos y electrónicos (RAEE)', categoria: 'electronicos', corriente: 'regu', subtipoRegu: 'raee', factorCo2: 1.4 },
  PLAQ: { nombre: 'Plaquetas electrónicas', categoria: 'electronicos', corriente: 'regu', subtipoRegu: 'raee', factorCo2: 2 },
  CABLE: { nombre: 'Cables', categoria: 'electronicos', corriente: 'regu', subtipoRegu: 'raee', factorCo2: 2 },
  PILAS: { nombre: 'Pilas y baterías', categoria: 'otros', corriente: 'regu', subtipoRegu: 'pilas_baterias', factorCo2: 0, tratamiento: 'disposicion_final' },
  NEUM: { nombre: 'Neumáticos fuera de uso', categoria: 'otros', corriente: 'regu', subtipoRegu: 'neumaticos', factorCo2: 0.6 },
  AVU: { nombre: 'Aceite vegetal usado', categoria: 'otros', corriente: 'regu', subtipoRegu: 'aceite_vegetal_usado', factorCo2: 2.5 },
  MEZCLA: { nombre: 'Residuos sin clasificar', categoria: 'otros', mezcla: true, valorizable: false, factorCo2: 0, unidades: [{ nombre: 'camión', kg: 6000 }] },
  RECH: { nombre: 'Rechazo (no valorizable)', categoria: 'otros', fraccion: 'basura', factorCo2: 0 },
};

/** Datos para crear el material `codigo` en una organización nueva. */
export function materialDelCatalogo(codigo) {
  const m = CATALOGO[codigo];
  if (!m) throw new Error(`El material ${codigo} no está en el catálogo`);
  return { codigo, factorCo2Fuente: FUENTE_EJEMPLO, tarifaRetiroKg: 0, precioVentaKg: m.precioReferencia?.minKg ?? 0, ...m };
}
