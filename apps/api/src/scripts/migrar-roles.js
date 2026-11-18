// Completa el rol de las organizaciones creadas antes de que existiera el campo.
//   cooperativas → operador · empresas y municipios → generador (eran clientes del portal)
// Uso: MONGO_URI="..." npm run migrar-roles -w apps/api
// Es idempotente: solo toca organizaciones sin rol.
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Organization, rolPorDefecto } from '../modules/organizations/organization.model.js';

await mongoose.connect(env.mongoUri);
const sinRol = await Organization.find({ rol: { $exists: false } }).select('tipo nombre');
for (const org of sinRol) {
  const rol = rolPorDefecto(org.tipo);
  await Organization.updateOne({ _id: org._id }, { $set: { rol } });
  console.log(`${org.nombre}: ${org.tipo} → ${rol}`);
}
console.log(`Listo: ${sinRol.length} organizaciones actualizadas.`);
await mongoose.disconnect();
