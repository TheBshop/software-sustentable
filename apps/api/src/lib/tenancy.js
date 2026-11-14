// Separación de datos entre cooperativas (multi-tenant).
//
// Cada request de un usuario de cooperativa corre dentro de un contexto (AsyncLocalStorage)
// con el id de su cooperativa. El plugin `tenantPlugin` usa ese contexto para:
//   - filtrar por `coop` toda consulta (find, count, update, delete, aggregate, populate)
//   - completar `coop` en cada alta
// Si una consulta a un modelo con tenant corre SIN contexto, lanza un error (modo estricto):
// un olvido se ve como error, nunca como datos de otra cooperativa.
//
// Para las pocas operaciones que deben cruzar cooperativas (verificación pública del QR,
// portal de clientes, scripts) hay que pedirlo explícitamente:
//   - runWithoutTenant(fn)             → todo lo que corra dentro
//   - query.setOptions({ sinTenant })  → una consulta puntual
import { AsyncLocalStorage } from 'node:async_hooks';
import mongoose from 'mongoose';

const als = new AsyncLocalStorage();

export const runWithTenant = (coop, fn) => als.run({ coop: String(coop) }, fn);
export const runWithoutTenant = (fn) => als.run({ sinTenant: true }, fn);
export const currentTenant = () => als.getStore()?.coop ?? null;

/**
 * Fija la cooperativa para el resto de la ejecución asíncrona actual (tests y scripts).
 * En la API usar siempre withTenant / runWithTenant, que acotan el contexto a un request.
 */
export const enterTenant = (coop) => als.enterWith({ coop: String(coop) });

/** Middleware (después de requireAuth): fija la cooperativa del usuario para todo el request. */
export function withTenant(req, _res, next) {
  const coop = req.user?.orgTipo === 'cooperativa' ? req.user.org : null;
  als.run(coop ? { coop } : {}, next);
}

const SKIP = Symbol('sinTenant');

function tenantOrThrow(modelName, sinTenantOption) {
  if (sinTenantOption) return SKIP;
  const store = als.getStore();
  if (store?.sinTenant) return SKIP;
  if (store?.coop) return store.coop;
  throw new Error(`Consulta a ${modelName} sin cooperativa en contexto. Usá runWithTenant o { sinTenant: true }.`);
}

const QUERY_OPS = [
  'find',
  'findOne',
  'countDocuments',
  'distinct',
  'findOneAndUpdate',
  'findOneAndDelete',
  'findOneAndReplace',
  'updateOne',
  'updateMany',
  'replaceOne',
  'deleteOne',
  'deleteMany',
];

export function tenantPlugin(schema) {
  schema.add({ coop: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true } });

  schema.pre(QUERY_OPS, function () {
    const coop = tenantOrThrow(this.model.modelName, this.getOptions().sinTenant);
    if (coop !== SKIP) this.where({ coop });
  });

  schema.pre('aggregate', function () {
    const coop = tenantOrThrow(this._model?.modelName ?? 'aggregate', this.options?.sinTenant);
    if (coop !== SKIP) this.pipeline().unshift({ $match: { coop: new mongoose.Types.ObjectId(coop) } });
  });

  // Altas con Model.create / doc.save(): la cooperativa sale del contexto
  schema.pre('validate', function () {
    if (this.coop) return;
    const coop = currentTenant();
    if (coop) this.coop = coop;
  });

  schema.pre('insertMany', function (next, docs) {
    const coop = currentTenant();
    for (const d of Array.isArray(docs) ? docs : [docs]) if (d && !d.coop && coop) d.coop = coop;
    next();
  });
}
