// Evidencia de cumplimiento: cada ítem de la matriz puede tener un número (inscripción,
// matrícula…), un vencimiento y un archivo adjunto. La matriz usa estos datos para calcular
// el estado "Al día / Vencido / Vence pronto / Sin cargar" de los ítems manuales. Los ítems
// automáticos se calculan de los registros y no se cargan acá.
import mongoose from 'mongoose';
import { tenantPlugin } from '../../lib/tenancy.js';

const evidenciaSchema = new mongoose.Schema(
  {
    item: { type: String, required: true }, // id del ítem de la matriz (ej. 'ambiental')
    cumple: { type: Boolean }, // marca manual cuando no hay archivo
    numero: { type: String, trim: true, maxlength: 80 },
    vence: Date,
    archivoUrl: String,
    archivoNombre: String,
    notas: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true },
);
evidenciaSchema.plugin(tenantPlugin);
evidenciaSchema.index({ coop: 1, item: 1 }, { unique: true });
export const Evidencia = mongoose.model('Evidencia', evidenciaSchema);

const DIA = 86400000;
/** Estado de una evidencia manual dado un umbral de preaviso (días). */
export function estadoEvidencia(e, aviso = 30) {
  if (!e) return { codigo: 'sin_cargar', txt: 'Sin cargar' };
  if (e.vence) {
    const diasQuedan = Math.ceil((new Date(e.vence).getTime() - Date.now()) / DIA);
    if (diasQuedan < 0) return { codigo: 'vencido', txt: `Venció hace ${-diasQuedan} días` };
    if (diasQuedan <= aviso) return { codigo: 'vence_pronto', txt: `Vence en ${diasQuedan} días` };
    return { codigo: 'cumple', txt: `Al día, vence el ${new Date(e.vence).toLocaleDateString('es-AR')}` };
  }
  if (e.archivoUrl || e.numero) return { codigo: 'cumple', txt: e.numero ? `N° ${e.numero}` : 'Al día' };
  if (e.cumple === true) return { codigo: 'cumple', txt: 'Marcado como cumplido' };
  if (e.cumple === false) return { codigo: 'no_cumple', txt: 'Marcado como no cumple' };
  return { codigo: 'sin_cargar', txt: 'Sin cargar' };
}
