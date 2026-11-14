import mongoose from 'mongoose';
import { currentTenant } from './tenancy.js';

// Numeración correlativa (retiro N° 1, 2, 3...) sin huecos por concurrencia.
// Cada cooperativa tiene su propia numeración: la clave es "<coop>:<nombre>".
const Counter = mongoose.model('Counter', new mongoose.Schema({ _id: String, seq: Number }));

export async function nextSeq(name) {
  const coop = currentTenant();
  if (!coop) throw new Error(`nextSeq("${name}") sin cooperativa en contexto`);
  const c = await Counter.findOneAndUpdate({ _id: `${coop}:${name}` }, { $inc: { seq: 1 } }, { upsert: true, new: true });
  return c.seq;
}
