// Datos de ejemplo para desarrollo. Los usan `npm run seed` (seed.js) y `npm run dev:memoria`.
// Usuarios (solo desarrollo; ver SEED_USUARIOS abajo):
//   Cooperativa Nueva Vida     admin@nuevavida.local / admin1234 · chofer@nuevavida.local / chofer1234
//   Cooperativa del Litoral    admin@litoral.local / admin1234
//   Empresa (portal)           empresa@elpuente.local / empresa1234   (cliente de las dos cooperativas)
//   Municipio (portal)         municipio@ejemplo.local / municipio1234 (tres sedes)
import { User } from './modules/users/user.model.js';
import { Organization } from './modules/organizations/organization.model.js';
import { Material } from './modules/materials/material.model.js';
import { Client } from './modules/clients/client.model.js';
import { Pickup } from './modules/pickups/pickup.model.js';
import { Intake, Sale } from './modules/plant/plant.models.js';
import { Invoice } from './modules/invoices/invoice.model.js';
import { issueCertificate } from './modules/certificates/certificate.service.js';
import { registrarIngreso, registrarVenta, registrarRechazo, sincronizarIngresoDeRetiro } from './modules/movimientos/movimiento.service.js';
import { nextSeq } from './lib/counters.js';
import { registrarClasificacion } from './modules/movimientos/movimiento.service.js';
import { resolverPesos } from './modules/materials/unidades.js';
import { anotarReferencias } from './modules/plant/ventas.service.js';
import { Gasto } from './modules/finanzas/gasto.model.js';
import { runWithTenant } from './lib/tenancy.js';

export const SEED_USUARIOS = [
  { email: 'admin@nuevavida.local', password: 'admin1234', org: 'nv', rol: 'admin', nombre: 'Admin Nueva Vida' },
  { email: 'chofer@nuevavida.local', password: 'chofer1234', org: 'nv', rol: 'chofer', nombre: 'Camión 1' },
  { email: 'admin@litoral.local', password: 'admin1234', org: 'litoral', rol: 'admin', nombre: 'Admin Litoral' },
  { email: 'empresa@elpuente.local', password: 'empresa1234', org: 'empresa', rol: 'cliente_admin', nombre: 'Laura (El Puente)' },
  { email: 'municipio@ejemplo.local', password: 'municipio1234', org: 'municipio', rol: 'cliente_admin', nombre: 'Área de Ambiente' },
];

// ⚠️ Factores de CO2 de EJEMPLO (kg CO2e evitado por kg reciclado). Antes de emitir
// certificados reales, la cooperativa debe reemplazarlos por factores de una fuente
// reconocida (p. ej. EPA WARM, DEFRA, o un estudio local) y documentar la fuente.
// Unidades estándar (peso sin balanza) y precios de referencia: valores de EJEMPLO.
// Cada cooperativa los ajusta en Materiales (pesando una vez cada tipo de fardo o bolsón).
const MATERIALES = [
  { codigo: 'CART', nombre: 'Cartón', categoria: 'papel_carton', factorCo2: 0.9, tarifaRetiroKg: 0, precioVentaKg: 120, unidades: [{ nombre: 'fardo', kg: 60 }, { nombre: 'bolsón', kg: 25 }], precioReferencia: { minKg: 120, maxKg: 240, fuente: 'Reaquila, precios de materiales reciclados (revisión 30/10/2026)', fecha: new Date('2026-10-30') } },
  { codigo: 'PAP', nombre: 'Papel blanco', categoria: 'papel_carton', factorCo2: 0.9, tarifaRetiroKg: 0, precioVentaKg: 150, unidades: [{ nombre: 'bolsón', kg: 30 }], precioReferencia: { minKg: 120, maxKg: 370, fuente: 'Reaquila, precios de materiales reciclados (revisión 30/10/2026)', fecha: new Date('2026-10-30') } },
  { codigo: 'PET', nombre: 'PET', categoria: 'plasticos', factorCo2: 1.5, tarifaRetiroKg: 20, precioVentaKg: 250, unidades: [{ nombre: 'bolsón', kg: 12 }, { nombre: 'fardo', kg: 80 }], precioReferencia: { minKg: 250, maxKg: 560, fuente: 'Reaquila, precios de materiales reciclados (revisión 30/10/2026)', fecha: new Date('2026-10-30') } },
  { codigo: 'PEAD', nombre: 'Polietileno (PEAD)', categoria: 'plasticos', factorCo2: 1.2, tarifaRetiroKg: 20, precioVentaKg: 200, unidades: [{ nombre: 'bolsón', kg: 15 }], precioReferencia: { minKg: 250, maxKg: 850, fuente: 'Reaquila, precios de materiales reciclados (revisión 30/10/2026)', fecha: new Date('2026-10-30') } },
  { codigo: 'VID', nombre: 'Vidrio', categoria: 'vidrio', factorCo2: 0.3, tarifaRetiroKg: 15, precioVentaKg: 30, unidades: [{ nombre: 'tambor', kg: 90 }], precioReferencia: { minKg: 50, maxKg: 85, fuente: 'Reaquila, precios de materiales reciclados (revisión 30/10/2026)', fecha: new Date('2026-10-30') } },
  { codigo: 'ALU', nombre: 'Aluminio', categoria: 'metales', factorCo2: 9, tarifaRetiroKg: 0, precioVentaKg: 1200, unidades: [{ nombre: 'bolsón', kg: 8 }], precioReferencia: { minKg: 1500, maxKg: 3500, fuente: 'Reaquila, precios de materiales reciclados (revisión 30/10/2026)', fecha: new Date('2026-10-30') } },
  { codigo: 'CHAT', nombre: 'Chatarra', categoria: 'metales', factorCo2: 1.5, tarifaRetiroKg: 0, precioVentaKg: 180, precioReferencia: { minKg: 100, maxKg: 250, fuente: 'Reaquila, precios de materiales reciclados (revisión 30/10/2026)', fecha: new Date('2026-10-30') } },
  { codigo: 'RECH', nombre: 'Rechazo (no valorizable)', categoria: 'otros', fraccion: 'basura', factorCo2: 0, tarifaRetiroKg: 0, precioVentaKg: 0 },
  // Lo que trae el camión municipal, todavía sin clasificar
  { codigo: 'MEZCLA', nombre: 'Residuos sin clasificar', categoria: 'otros', mezcla: true, valorizable: false, factorCo2: 0, tarifaRetiroKg: 0, precioVentaKg: 0, unidades: [{ nombre: 'camión', kg: 6000 }] },
];
// Solo para cooperativas habilitadas para REGU (Res. 522/2016)
const MATERIALES_REGU = [
  { codigo: 'AVU', nombre: 'Aceite vegetal usado', categoria: 'otros', corriente: 'regu', subtipoRegu: 'aceite_vegetal_usado', factorCo2: 2.5, tarifaRetiroKg: 30, precioVentaKg: 300 },
  { codigo: 'RAEE', nombre: 'Electrónicos (RAEE)', categoria: 'electronicos', corriente: 'regu', subtipoRegu: 'raee', factorCo2: 1.4, tarifaRetiroKg: 50, precioVentaKg: 100 },
];

const DAY = 24 * 60 * 60 * 1000;

/** Carga los datos de ejemplo. Asume una base vacía y ya conectada. */
export async function seedDatabase() {
  const orgs = {
    nv: await Organization.create({ tipo: 'cooperativa', nombre: 'Cooperativa Nueva Vida', cuit: '30700000014', habilitaciones: { corrientes: ['rsu', 'regu'] }, certificado: { responsable: 'Responsable de ejemplo', cargo: 'Presidencia' } }),
    litoral: await Organization.create({ tipo: 'cooperativa', nombre: 'Cooperativa Reciclar del Litoral', cuit: '30700000022', habilitaciones: { corrientes: ['rsu'] } }),
    empresa: await Organization.create({ tipo: 'empresa', nombre: 'Supermercado El Puente SA', cuit: '30712345678' }),
    municipio: await Organization.create({ tipo: 'municipio', nombre: 'Municipio de Ejemplo', cuit: '30999999991' }),
  };
  const users = {};
  for (const u of SEED_USUARIOS) {
    users[u.email] = await User.create({ nombre: u.nombre, email: u.email, rol: u.rol, organizacion: orgs[u.org]._id, passwordHash: await User.hashPassword(u.password) });
  }

  await runWithTenant(orgs.nv._id, () => seedNuevaVida(orgs, users['chofer@nuevavida.local']));
  await runWithTenant(orgs.litoral._id, () => seedLitoral(orgs, users['admin@litoral.local']));
  return orgs;
}

async function seedNuevaVida(orgs, chofer) {
  const mats = await Material.insertMany([...MATERIALES, ...MATERIALES_REGU].map((m) => new Material(m)));
  const m = Object.fromEntries(mats.map((x) => [x.codigo, x]));

  const [superm, hotel, escuela, distri, municipio, acopio] = await Client.insertMany(
    [
      {
        razonSocial: 'Supermercado El Puente SA', cuit: '30712345678', organizacion: orgs.empresa._id,
        contacto: { nombre: 'Laura', email: 'compras@elpuente.example', telefono: '5493430000001' },
        direcciones: [{ alias: 'Sucursal Centro', direccion: 'Av. Ejemplo 1200, Paraná' }],
        tarifa: { modalidad: 'por_retiro', montoFijo: 15000 },
        contrato: { numero: 'GG-2026-001', inicio: new Date('2026-01-01'), fin: new Date('2026-12-31'), frecuenciaRetiro: 'martes y viernes', diasPagoFactura: 15 },
      },
      {
        razonSocial: 'Hotel Costa Serena SRL', cuit: '30798765432',
        contacto: { nombre: 'Martín', email: 'admin@costaserena.example', telefono: '5493430000002' },
        direcciones: [{ direccion: 'Calle Ribera 455, Paraná' }],
        tarifa: { modalidad: 'por_kg', preciosPorKg: [] },
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
        tarifa: { modalidad: 'por_kg', preciosPorKg: [] },
      },
      {
        // El municipio es un cliente más, con varias sedes (dependencias)
        razonSocial: 'Municipio de Ejemplo', cuit: '30999999991', organizacion: orgs.municipio._id,
        contacto: { nombre: 'Área de Ambiente', email: 'ambiente@municipio.example', telefono: '5493430000005' },
        direcciones: [
          { alias: 'Palacio municipal', direccion: 'Plaza Central s/n' },
          { alias: 'Escuela N° 12', direccion: 'Calle de la Escuela 120' },
          { alias: 'Polideportivo', direccion: 'Av. de los Deportes 900' },
        ],
        tarifa: { modalidad: 'sin_cargo' },
      },
      { tipo: 'comprador', razonSocial: 'Acopiadora Litoral (comprador)', cuit: '30711111119' },
    ].map((c) => new Client(c)),
  );
  hotel.tarifa.preciosPorKg = [{ material: m.VID._id, precio: 25 }];
  distri.tarifa.preciosPorKg = [{ material: m.CART._id, precio: 8 }];
  await hotel.save();
  await distri.save();

  const plan = {
    [superm.id]: (i) => [['CART', 180 + ((i * 37) % 90)], ['PEAD', 25 + ((i * 7) % 18)]],
    [hotel.id]: (i) => [['VID', 70 + ((i * 13) % 45)], ['PET', 12 + ((i * 5) % 9)], ['AVU', 10 + (i % 4)]],
    [escuela.id]: (i) => [['PAP', 40 + ((i * 11) % 25)], ['CART', 30]],
    [distri.id]: (i) => [['CART', 300 + ((i * 29) % 120)], ['PEAD', 50], ['ALU', 6]],
    [municipio.id]: (i) => [['PAP', 60 + ((i * 7) % 30)], ['CART', 40], ['RAEE', i % 2 ? 15 : 0]].filter(([, kg]) => kg > 0),
  };
  const orden = [superm, hotel, municipio, distri, superm, escuela, municipio, hotel, superm, distri, municipio];
  const now = Date.now();
  for (let i = 0; i < 20; i++) {
    const cliente = orden[i % orden.length];
    const diasAtras = 40 - Math.round(i * 2);
    const pesado = diasAtras > 2;
    const sede = cliente.direcciones[i % cliente.direcciones.length];
    const p = await Pickup.create({
      numero: await nextSeq('retiro'),
      cliente: cliente._id,
      direccion: sede?.alias ? `${sede.alias} — ${sede.direccion}` : sede?.direccion,
      fecha: new Date(now - diasAtras * DAY),
      chofer: chofer._id,
      estado: pesado ? 'en_planta' : 'registrado',
      items: plan[cliente.id](i).map(([cod, kg]) => ({
        material: m[cod]._id,
        pesoEstimadoKg: kg,
        ...(pesado && { pesoRealKg: Math.max(1, kg + ((i * 7) % 11) - 5) }),
      })),
    });
    if (pesado) await sincronizarIngresoDeRetiro(p, chofer._id); // ingreso a planta + movimientos
    if (diasAtras > 6) await issueCertificate(p._id);
  }

  const recuperador = await Intake.create({ fecha: new Date(now - 4 * DAY), origen: 'recuperador', detalleOrigen: 'Recuperador independiente', items: [{ material: m.CART._id, pesoKg: 85 }, { material: m.ALU._id, pesoKg: 4 }] });
  await registrarIngreso(recuperador);

  for (const [dias, items] of [
    [35, [['CART', 900, 85]]], // como la venta de junio 2025 del diagnóstico: muy por debajo del mercado
    [20, [['CART', 1200, 150], ['PEAD', 200, 200]]],
    [8, [['VID', 300, 30], ['ALU', 20, 1600]]],
  ]) {
    const data = { fecha: new Date(now - dias * DAY), comprador: acopio._id, remito: `R-${1000 + dias}`, items: items.map(([c, kg, p]) => ({ material: m[c]._id, pesoKg: kg, precioKg: p })), cobrada: dias > 10 };
    await anotarReferencias(data);
    const sale = await Sale.create(data);
    await registrarVenta(sale);
  }
  // El rechazo se descuenta del material que se rechaza (acá, cartón húmedo/contaminado)
  await registrarRechazo({ material: m.CART._id, kg: 140, fecha: new Date(now - 5 * DAY), causa: 'humedad', cliente: superm._id, motivo: 'Cartón mojado, a relleno sanitario' });

  // Camiones municipales: entran como mezcla (sin balanza, por camión) y se clasifican.
  // Del total, solo una parte se recupera (el diagnóstico habla de 3-4 t de 20 t diarias).
  for (const dias of [12, 6, 1]) {
    const fecha = new Date(now - dias * DAY);
    const items = await resolverPesos([{ material: m.MEZCLA._id, cantidad: 2, unidad: 'camión' }], 'pesoKg');
    const ingreso = await Intake.create({ fecha, origen: 'recoleccion_municipal', detalleOrigen: 'Recolección municipal zona centro', items });
    await registrarIngreso(ingreso);
    await registrarClasificacion({
      desde: m.MEZCLA._id,
      fecha,
      items: [
        { material: m.CART._id, kg: 1100 + dias * 10 },
        { material: m.PET._id, kg: 320 },
        { material: m.PEAD._id, kg: 260 },
        { material: m.ALU._id, kg: 35 },
        { material: m.VID._id, kg: 400 },
      ],
      rechazoKg: 9000,
      causa: 'mezclado',
    });
  }

  // Gastos del mes (para el balance)
  await Gasto.insertMany(
    [
      [20, 'combustible', 'Gasoil camión volcador', 85000],
      [12, 'combustible', 'Gasoil camión volcador', 92000],
      [9, 'reparaciones', 'Reparación enfardadora de cartón', 240000],
      [7, 'indumentaria', 'Guantes y barbijos', 60000],
      [3, 'combustible', 'Gasoil tractor pala', 48000],
      [2, 'repuestos', 'Cinta para enfardar', 35000],
    ].map(([d, categoria, descripcion, monto]) => new Gasto({ fecha: new Date(now - d * DAY), categoria, descripcion, monto })),
  );

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
      periodo: { desde: new Date(now - 75 * DAY), hasta: new Date(now - 45 * DAY) },
      lineas: ls,
      total,
      emitidaEn: new Date(now - emitida * DAY),
      vencimiento: new Date(now + vence * DAY),
      estado: pagada ? 'pagada' : 'pendiente',
      pagos: pagada ? [{ monto: total, medio: 'transferencia', fecha: new Date(now - 3 * DAY) }] : [],
    });
  }
}

/** Segunda cooperativa: mismos códigos de material y mismo cliente (El Puente), datos separados. */
async function seedLitoral(orgs, admin) {
  const mats = await Material.insertMany(MATERIALES.slice(0, 5).map((x) => new Material({ ...x, precioVentaKg: x.precioVentaKg + 10 })));
  const m = Object.fromEntries(mats.map((x) => [x.codigo, x]));
  const [puente] = await Client.insertMany([
    new Client({
      razonSocial: 'Supermercado El Puente SA', cuit: '30712345678', organizacion: orgs.empresa._id,
      direcciones: [{ alias: 'Sucursal Santa Fe', direccion: 'Bv. Ejemplo 300, Santa Fe' }],
      tarifa: { modalidad: 'por_retiro', montoFijo: 18000 },
      contrato: { diasPagoFactura: 20 },
    }),
  ]);
  const now = Date.now();
  for (let i = 0; i < 4; i++) {
    const p = await Pickup.create({
      numero: await nextSeq('retiro'),
      cliente: puente._id,
      direccion: 'Sucursal Santa Fe — Bv. Ejemplo 300, Santa Fe',
      fecha: new Date(now - (25 - i * 6) * DAY),
      chofer: admin._id,
      estado: 'en_planta',
      items: [{ material: m.CART._id, pesoEstimadoKg: 150 + i * 10, pesoRealKg: 148 + i * 10 }, { material: m.PET._id, pesoEstimadoKg: 20, pesoRealKg: 22 }],
    });
    await sincronizarIngresoDeRetiro(p, admin._id);
    if (i < 3) await issueCertificate(p._id);
  }
  await Invoice.create({
    numero: await nextSeq('factura'),
    cliente: puente._id,
    clienteSnapshot: { razonSocial: puente.razonSocial, cuit: puente.cuit },
    periodo: { desde: new Date(now - 60 * DAY), hasta: new Date(now - 30 * DAY) },
    lineas: [{ descripcion: 'Servicio de retiro de materiales reciclables', cantidad: 4, unidad: 'retiro', precioUnitario: 18000, subtotal: 72000 }],
    total: 72000,
    emitidaEn: new Date(now - 12 * DAY),
    vencimiento: new Date(now + 8 * DAY),
  });
}
