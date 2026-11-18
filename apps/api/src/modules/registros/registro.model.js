// Registros de la operación que no tienen un módulo propio (recolección, destino y costos del
// municipio, compras y traslados de la recicladora, combustible, electricidad…). La definición de
// cada registro (campos, opciones, ayudas) sale del catálogo REG de @nueva-vida/catalogos.
import mongoose from 'mongoose';
import { z } from 'zod';
import { REG } from '@nueva-vida/catalogos';
import { tenantPlugin } from '../../lib/tenancy.js';
import { dateInput, parseLocalDate } from '../../lib/validation.js';

const registroSchema = new mongoose.Schema(
  {
    registro: { type: String, required: true }, // id de la definición (ej. 'recoleccion')
    fecha: { type: Date }, // registros con mes; los padrones (sinMes) no llevan
    datos: { type: mongoose.Schema.Types.Mixed, required: true },
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, minimize: false },
);
registroSchema.plugin(tenantPlugin);
registroSchema.index({ coop: 1, registro: 1, fecha: -1 });
export const RegistroServicio = mongoose.model('RegistroServicio', registroSchema);

/** Perfil de la página según el tipo de organización operadora. */
export const PERFIL_REG = { cooperativa: 'cooperativa', recicladora: 'empresa', municipio: 'municipio' };
export const perfilDe = (org) => PERFIL_REG[org?.tipo] ?? 'cooperativa';

export const definiciones = (perfil) => REG[perfil] ?? [];
export const definicion = (perfil, id) => definiciones(perfil).find((d) => d.id === id);

const OPCIONALES = new Set(['comprobante', 'pesaje']);

/** Esquema Zod de un registro, armado desde sus campos. Devuelve { fecha, datos }. */
export function esquemaRegistro(def) {
  const forma = {};
  let primerTexto = true;
  for (const c of def.campos) {
    if (c.k === 'fecha') continue;
    let s;
    if (c.tipo === 'num') s = z.coerce.number().min(0, `${c.label}: no puede ser negativo`);
    else if (c.tipo === 'sel') s = z.enum(c.op, { message: `${c.label}: elegí una opción` });
    else s = z.string().trim().max(200);
    const requerido = c.tipo === 'texto' ? def.sinMes && primerTexto : !OPCIONALES.has(c.k);
    if (c.tipo === 'texto') primerTexto = false;
    if (c.tipo === 'texto' && requerido) s = s.min(1, `${c.label}: es obligatorio`);
    forma[c.k] = requerido ? s : s.optional().or(z.literal('').transform(() => undefined));
  }
  const conFecha = def.campos.some((c) => c.k === 'fecha');
  return z
    .object({
      fecha: conFecha && !def.sinMes ? dateInput : dateInput.optional(),
      mes: def.mensual ? z.string().regex(/^\d{4}-\d{2}$/, 'Mes con formato AAAA-MM') : z.string().optional(),
      datos: z.object(forma),
    })
    .transform(({ fecha, mes, datos }) => ({
      fecha: def.mensual ? parseLocalDate(`${mes}-01`) : fecha,
      datos: Object.fromEntries(Object.entries({ ...datos, ...(conFecha && def.sinMes && fecha && { fecha }) }).filter(([, v]) => v !== undefined)),
    }));
}
