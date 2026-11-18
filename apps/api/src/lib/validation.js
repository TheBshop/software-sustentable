import { z } from 'zod';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'ID inválido');

// Zona horaria de la cooperativa. Sin esto, "2026-11-13" se interpreta como medianoche UTC,
// que en Argentina todavía es el 12/11 a las 21 h, y las fechas se ven un día antes.
export const TZ_OFFSET = process.env.TZ_OFFSET ?? '-03:00';
const DAY_MS = 24 * 60 * 60 * 1000;

/** Una fecha "2026-11-13" (sin hora) → medianoche de ese día en hora de Argentina. */
export function parseLocalDate(v) {
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(`${v}T00:00:00${TZ_OFFSET}`);
  return v instanceof Date ? v : new Date(v);
}

/** Último milisegundo del día local que empieza en `d` (para rangos "hasta"). */
export const endOfLocalDay = (d) => new Date(parseLocalDate(d).getTime() + DAY_MS - 1);

/** Primer día del mes en curso, en hora de Argentina. */
export function startOfLocalMonth(now = new Date()) {
  const local = new Date(now.getTime() + offsetMs());
  const ym = local.toISOString().slice(0, 7);
  return parseLocalDate(`${ym}-01`);
}
function offsetMs() {
  const [, sign, h, m] = TZ_OFFSET.match(/([+-])(\d{2}):(\d{2})/);
  return (sign === '-' ? -1 : 1) * (Number(h) * 60 + Number(m)) * 60 * 1000;
}

/** Fechas que llegan como string: "2026-11-13" (día local) o ISO con hora. */
export const dateInput = z.preprocess((v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? parseLocalDate(v) : v), z.coerce.date());

export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const round2 = (n) => Math.round(n * 100) / 100;
