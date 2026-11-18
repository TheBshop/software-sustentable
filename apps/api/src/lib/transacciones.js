// Transacciones: una acción que escribe en varios lugares (alta + movimientos de stock,
// venta + remito, retiro + ingreso) se guarda entera o no se guarda.
//
// Con `transactionAsyncLocalStorage`, toda consulta de Mongoose que corra dentro de
// `enTransaccion(fn)` usa la sesión de la transacción sin pasarla a mano.
// Requiere un replica set (MongoDB Atlas lo es; en desarrollo y tests: MongoMemoryReplSet).
import mongoose from 'mongoose';

mongoose.set('transactionAsyncLocalStorage', true);

/** Corre `fn` en una transacción: si algo falla, se deshace todo lo que escribió. */
export const enTransaccion = (fn) => mongoose.connection.transaction(fn);
