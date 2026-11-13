import { z } from 'zod';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'ID inválido');

/** Fechas que llegan como string ISO ("2026-11-13" o con hora). */
export const dateInput = z.coerce.date();

export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const round2 = (n) => Math.round(n * 100) / 100;
