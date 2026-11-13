// Datos de ejemplo para desarrollo. Los usan `npm run seed` (seed.js) y `npm run dev:memoria`.
// Usuarios: admin@nuevavida.local / admin1234 · chofer@nuevavida.local / chofer1234 (solo desarrollo)
import { User } from './modules/users/user.model.js';
import { Material } from './modules/materials/material.model.js';
import { Client } from './modules/clients/client.model.js';
import { Pickup } from './modules/pickups/pickup.model.js';
import { Intake, Sale } from './modules/plant/plant.models.js';
import { Invoice } from './modules/invoices/invoice.model.js';
import { issueCertificate } from './modules/certificates/certificate.service.js';
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

const DAY = 24 * 60 * 60 * 1000;

/** Carga los datos de ejemplo. Asume una base vacía y ya conectada. */
export async function seedDatabase() {
  await User.create({ nombre: 'Admin', email: 'admin@nuevavida.local', passwordHash: await User.hashPassword('admin1234'), rol: 'admin' });
  const chofer = await User.create({ nombre: 'Camión 1', email: 'chofer@nuevavida.local', passwordHash: await User.hashPassword('chofer1234'), rol: 'chofer' });

  const mats = await Material.insertMany(MATERIALES);
  const m = Object.fromEntries(mats.map((x) => [x.codigo, x]));

  const [superm, hotel, escuela, distri, acopio] = await Client.insertMany([
    {
      razonSocial: 'Supermercado El Puente SA', cuit: '30712345678',
      contacto: { nombre: 'Laura', email: 'compras@elpuente.example', telefono: '5493430000001' },
      direcciones: [{ alias: 'Sucursal Centro', direccion: 'Av. Ejemplo 1200, Paraná' }],
      tarifa: { modalidad: 'por_retiro', montoFijo: 15000 },
      contrato: { numero: 'GG-2026-001', inicio: new Date('2026-01-01'), fin: new Date('2026-12-31'), frecuenciaRetiro: 'martes y viernes', diasPagoFactura: 15 },
    },
    {
      razonSocial: 'Hotel Costa Serena SRL', cuit: '30798765432',
      contacto: { nombre: 'Martín', email: 'admin@costaserena.example', telefono: '5493430000002' },
      direcciones: [{ direccion: 'Calle Ribera 455, Paraná' }],
      tarifa: { modalidad: 'por_kg', preciosPorKg: [{ material: m.VID._id, precio: 25 }] },
      contrato: { diasPagoFactura: 10 },
    },
    {
      razonSocial: 'Escuela Técnica Modelo', cuit: '30700111223',
      contacto: { email: 'direccion@etmodelo.example', telefono: '5493430000003' },
      direcciones: [{ direccion: 'Pasaje Escolar 80, Paraná' }],
      tarifa: { modalidad: 'abono_mensual', montoFijo: 40000 },
      contrato: { diasPagoFactura: 30 },
    },
    {
      razonSocial: 'Distribuidora Litoral Sur', cuit: '30715554441',
      contacto: { email: 'logistica@litoralsur.example', telefono: '5493430000004' },
      direcciones: [{ direccion: 'Ruta 12 km 5, Paraná' }],
      tarifa: { modalidad: 'por_kg', preciosPorKg: [{ material: m.CART._id, precio: 8 }] },
    },
    { tipo: 'comprador', razonSocial: 'Acopiadora Litoral (comprador)', cuit: '30711111119' },
  ]);

  const plan = {
    [superm.id]: (i) => [['CART', 180 + ((i * 37) % 90)], ['PEAD', 25 + ((i * 7) % 18)]],
    [hotel.id]: (i) => [['VID', 70 + ((i * 13) % 45)], ['PET', 12 + ((i * 5) % 9)]],
    [escuela.id]: (i) => [['PAP', 40 + ((i * 11) % 25)], ['CART', 30]],
    [distri.id]: (i) => [['CART', 300 + ((i * 29) % 120)], ['PEAD', 50], ['ALU', 6]],
  };
  const orden = [superm, hotel, distri, superm, escuela, hotel, superm, distri];
  const now = Date.now();
  for (let i = 0; i < 16; i++) {
    const cliente = orden[i % 8];
    const diasAtras = 27 - Math.round(i * 1.75);
    const pesado = diasAtras > 2;
    const p = await Pickup.create({
      numero: await nextSeq('retiro'),
      cliente: cliente._id,
      direccion: cliente.direcciones[0]?.direccion,
      fecha: new Date(now - diasAtras * DAY),
      chofer: chofer._id,
      estado: pesado ? 'en_planta' : 'registrado',
      items: plan[cliente.id](i).map(([cod, kg]) => ({
        material: m[cod]._id,
        pesoEstimadoKg: kg,
        ...(pesado && { pesoRealKg: Math.max(1, kg + ((i * 7) % 11) - 5) }),
      })),
    });
    if (diasAtras > 6) await issueCertificate(p._id);
    if (pesado) {
      await Intake.create({ fecha: p.fecha, origen: 'retiro', retiro: p._id, items: p.items.map((it) => ({ material: it.material, pesoKg: it.pesoRealKg })) });
    }
  }
  await Intake.create({ fecha: new Date(now - 4 * DAY), origen: 'recuperador', detalleOrigen: 'Recuperador independiente', items: [{ material: m.CART._id, pesoKg: 85 }, { material: m.ALU._id, pesoKg: 4 }] });

  for (const [dias, items] of [
    [20, [['CART', 1200, 120], ['PEAD', 300, 200]]],
    [8, [['VID', 900, 30], ['ALU', 40, 1200]]],
  ]) {
    await Sale.create({ fecha: new Date(now - dias * DAY), comprador: acopio._id, remito: `R-${1000 + dias}`, items: items.map(([c, kg, p]) => ({ material: m[c]._id, pesoKg: kg, precioKg: p })), cobrada: dias > 10 });
  }

  // Liquidaciones del mes anterior: una vencida, una por vencer y una pagada
  const snap = (c) => ({ razonSocial: c.razonSocial, cuit: c.cuit, condicionIva: c.condicionIva });
  for (const [c, lineas, emitida, vence, pagada] of [
    [superm, [['Servicio de retiro de materiales reciclables', 8, 'retiro', 15000]], 26, -11, false],
    [hotel, [['Retiro y gestión de Vidrio', 610, 'kg', 25], ['Retiro y gestión de PET', 160, 'kg', 20]], 6, 4, false],
    [escuela, [['Abono mensual servicio de retiro', 1, 'mes', 40000]], 20, 10, true],
  ]) {
    const ls = lineas.map(([descripcion, cantidad, unidad, precioUnitario]) => ({ descripcion, cantidad, unidad, precioUnitario, subtotal: cantidad * precioUnitario }));
    const total = ls.reduce((a, l) => a + l.subtotal, 0);
    await Invoice.create({
      numero: await nextSeq('factura'),
      cliente: c._id,
      clienteSnapshot: snap(c),
      periodo: { desde: new Date(now - 60 * DAY), hasta: new Date(now - 30 * DAY) },
      lineas: ls,
      total,
      emitidaEn: new Date(now - emitida * DAY),
      vencimiento: new Date(now + vence * DAY),
      estado: pagada ? 'pagada' : 'pendiente',
      pagos: pagada ? [{ monto: total, medio: 'transferencia', fecha: new Date(now - 3 * DAY) }] : [],
    });
  }
}
