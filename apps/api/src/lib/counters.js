import mongoose from 'mongoose';

// Numeración correlativa (retiro N° 1, 2, 3...) sin huecos por concurrencia.
const Counter = mongoose.model('Counter', new mongoose.Schema({ _id: String, seq: Number }));

export async function nextSeq(name) {
  const c = await Counter.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { upsert: true, new: true });
  return c.seq;
}
