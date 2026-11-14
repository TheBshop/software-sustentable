import { Material } from './material.model.js';
import { HttpError } from '../../middleware/error.js';
import { round2 } from '../../lib/validation.js';

/**
 * Peso sin balanza. Si un renglón trae `cantidad` + `unidad` (ej. 3 fardos), calcula los kg
 * con el peso estándar de esa unidad para el material y los guarda en `campoPeso`.
 * Si trae los kg directamente, los respeta.
 * Devuelve los renglones con `campoPeso` completo y `estimado: true` cuando se convirtió.
 */
export async function resolverPesos(items, campoPeso) {
  const conUnidad = items.filter((i) => i.unidad && i.cantidad != null);
  if (!conUnidad.length) return items;
  const materiales = new Map((await Material.find({ _id: { $in: conUnidad.map((i) => i.material) } })).map((m) => [String(m._id), m]));
  return items.map((i) => {
    if (!i.unidad || i.cantidad == null) return i;
    const m = materiales.get(String(i.material));
    const nombre = String(i.unidad).trim().toLowerCase();
    if (nombre === 'kg') return { ...i, [campoPeso]: i.cantidad, unidad: undefined, cantidad: undefined };
    const u = m?.unidades?.find((x) => x.nombre === nombre);
    if (!u) {
      const disponibles = m?.unidades?.map((x) => x.nombre).join(', ');
      throw new HttpError(422, `${m?.nombre ?? 'El material'} no tiene la unidad "${i.unidad}"${disponibles ? `. Unidades: ${disponibles}` : ''}. Configurala en Materiales.`);
    }
    return { ...i, unidad: nombre, [campoPeso]: round2(i.cantidad * u.kg), estimado: true };
  });
}
