// Carga datos de ejemplo para desarrollo:  npm run seed
// Usuario admin: admin@nuevavida.local / admin1234  (solo para desarrollo local)
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { User } from './modules/users/user.model.js';
import { Material } from './modules/materials/material.model.js';
import { Client } from './modules/clients/client.model.js';
import { Pickup } from './modules/pickups/pickup.model.js';
import { nextSeq } from './lib/counters.js';

// ⚠️ Factores de CO2 de EJEMPLO (kg CO2e evitado por kg reciclado). Antes de emitir
// certificados reales, la cooperativa debe reemplazarlos por factores de una fuente
// reconocida (p. ej. EPA WARM, DEFRA, o un estudio local) y documentar la fuente.
const MATERIALES = [
  { codigo: 'CART', nombre: 'Cartón', categoria: 'papel_carton', factorCo2: 0.9, tarifaRetiroKg: 0, precioVentaKg: 120 },
  { codigo: 'PAP', nombre: 'Papel blanco', categoria: 'papel_carton', factorCo2: 0.9, tarifaRetiroKg: 0, precioVentaKg: 150 },
  { codigo: 'PET', nombre: 'PET', categoria: 'plasticos', factorCo2: 1.5, tarifaRetiroKg: 20, precioVentaKg: 250 },
  { codigo: 'PEAD', nombre: 'Polietileno (PEAD)', categoria: 'plasticos', factorCo2: 1.2, tarifaRetiroKg: 20, precioVentaKg: 200 },
  { codigo: 'VID', nombre: 'Vidrio', categoria: 'vidrio', factorCo2: 0.3, tarifaRetiroKg: 15, precioVentaKg: 30 },
  { codigo: 'ALU', nombre: 'Aluminio', categoria: 'metales', factorCo2: 9, tarifaRetiroKg: 0, precioVentaKg: 1200 },
  { codigo: 'CHAT', nombre: 'Chatarra', categoria: 'metales', factorCo2: 1.5, tarifaRetiroKg: 0, precioVentaKg: 180 },
];

await mongoose.connect(env.mongoUri);
await mongoose.connection.dropDatabase();

const admin = await User.create({ nombre: 'Admin', email: 'admin@nuevavida.local', passwordHash: await User.hashPassword('admin1234'), rol: 'admin' });
await User.create({ nombre: 'Chofer Demo', email: 'chofer@nuevavida.local', passwordHash: await User.hashPassword('chofer1234'), rol: 'chofer' });

const mats = await Material.insertMany(MATERIALES);
const byCode = Object.fromEntries(mats.map((m) => [m.codigo, m]));

const [super1, hotel] = await Client.insertMany([
  {
    razonSocial: 'Supermercado Ejemplo SA',
    cuit: '30712345678',
    contacto: { nombre: 'Laura', email: 'compras@super-ejemplo.test', telefono: '5493430000001' },
    direcciones: [{ alias: 'Sucursal Centro', direccion: 'Calle Ejemplo 123, Paraná' }],
    tarifa: { modalidad: 'por_retiro', montoFijo: 15000 },
    contrato: { numero: 'GG-2026-001', inicio: new Date('2026-01-01'), frecuenciaRetiro: 'martes y viernes', diasPagoFactura: 15 },
  },
  {
    razonSocial: 'Hotel Ejemplo SRL',
    cuit: '30798765432',
    contacto: { nombre: 'Martín', email: 'admin@hotel-ejemplo.test', telefono: '5493430000002' },
    direcciones: [{ direccion: 'Av. Ejemplo 456, Paraná' }],
    tarifa: { modalidad: 'por_kg', preciosPorKg: [{ material: byCode.VID._id, precio: 25 }] },
  },
  { tipo: 'comprador', razonSocial: 'Acopiadora Litoral (comprador)', cuit: '30711111119' },
]);

const hoy = new Date();
for (let i = 0; i < 10; i++) {
  const fecha = new Date(hoy.getFullYear(), hoy.getMonth(), Math.max(1, hoy.getDate() - i * 2));
  await Pickup.create({
    numero: await nextSeq('retiro'),
    cliente: i % 2 ? hotel._id : super1._id,
    fecha,
    chofer: admin._id,
    items:
      i % 2
        ? [{ material: byCode.VID._id, pesoEstimadoKg: 80 + i * 5 }, { material: byCode.PET._id, pesoEstimadoKg: 15 }]
        : [{ material: byCode.CART._id, pesoEstimadoKg: 200 + i * 10, pesoRealKg: 190 + i * 10 }, { material: byCode.PEAD._id, pesoEstimadoKg: 30 }],
  });
}

console.log('Seed OK → admin@nuevavida.local / admin1234');
await mongoose.disconnect();
