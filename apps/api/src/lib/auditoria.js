// Registro de auditoría: quién cargó, cambió o borró qué, y cuándo.
//
// `auditPlugin` se aplica (vía tenantPlugin) a todos los modelos con tenant. Registra solo lo que
// hace un usuario dentro de un request (withTenant deja su id en el contexto): las altas masivas
// de scripts y datos de ejemplo no generan entradas. Si falla la escritura del registro, la
// operación principal sigue: se avisa por consola.
import mongoose from 'mongoose';
import { currentTenant, currentUser } from './tenancy.js';

const OCULTOS = new Set(['_id', '__v', 'coop', 'createdAt', 'updatedAt', 'passwordHash']);

const auditLogSchema = new mongoose.Schema(
  {
    coop: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    accion: { type: String, enum: ['alta', 'cambio', 'baja'], required: true },
    entidad: { type: String, required: true },
    entidadId: { type: mongoose.Schema.Types.ObjectId },
    cambios: { type: mongoose.Schema.Types.Mixed },
    fecha: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false },
);
auditLogSchema.index({ coop: 1, entidad: 1, entidadId: 1, fecha: -1 });
export const AuditLog = mongoose.model('AuditLog', auditLogSchema);

const limpiar = (obj = {}) => {
  const o = {};
  for (const [k, v] of Object.entries(obj)) if (!OCULTOS.has(k)) o[k] = v;
  return Object.keys(o).length ? o : undefined;
};

async function registrar(accion, entidad, doc, cambios) {
  const usuario = currentUser();
  const coop = doc?.coop ?? currentTenant();
  if (!usuario || !coop) return;
  try {
    await AuditLog.create({ coop, usuario, accion, entidad, entidadId: doc?._id, cambios: limpiar(cambios) });
  } catch (err) {
    console.error(`Auditoría: no se pudo registrar ${accion} de ${entidad}: ${err.message}`);
  }
}

/** Cambios de un update de Mongo ({ $set: {...}, campo: valor }) como objeto plano. */
const planoDeUpdate = (u = {}) => {
  const plano = {};
  for (const [k, v] of Object.entries(u)) {
    if (k === '$set') Object.assign(plano, v);
    else plano[k] = v;
  }
  return plano;
};

export function auditPlugin(schema) {
  schema.pre('save', function () {
    this.$locals.auditoria = this.isNew ? 'alta' : 'cambio';
    if (!this.isNew) this.$locals.modificados = this.modifiedPaths({ includeChildren: false });
  });
  schema.post('save', async function (doc) {
    const accion = doc.$locals.auditoria;
    const cambios = accion === 'alta' ? doc.toObject() : Object.fromEntries((doc.$locals.modificados ?? []).map((p) => [p, doc.get(p)]));
    await registrar(accion, doc.constructor.modelName, doc, cambios);
  });
  schema.post('insertMany', async function (docs) {
    for (const d of docs) await registrar('alta', this.modelName, d, d.toObject?.() ?? d);
  });
  schema.post(['findOneAndUpdate', 'updateOne'], async function (res) {
    const id = res?._id ?? this.getFilter()._id;
    await registrar('cambio', this.model.modelName, { _id: id, coop: res?.coop }, planoDeUpdate(this.getUpdate()));
  });
  schema.post(['findOneAndDelete', 'deleteOne'], async function (res) {
    if (res?.deletedCount === 0 || res === null) return;
    const id = res?._id ?? this.getFilter?.()._id;
    await registrar('baja', this.model?.modelName ?? this.constructor.modelName, { _id: id, coop: res?.coop }, res?.toObject?.());
  });
}
