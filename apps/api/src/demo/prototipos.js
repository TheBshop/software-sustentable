// Arma el prototipo de una organización: su cuenta, sus materiales, su marco normativo y,
// opcionalmente, datos de ejemplo para que el sistema no se vea vacío en la primera prueba.
// Los datos de ejemplo son ficticios y están rotulados como tales.
import { Organization } from '../modules/organizations/organization.model.js';
import { User } from '../modules/users/user.model.js';
import { Material } from '../modules/materials/material.model.js';
import { Client } from '../modules/clients/client.model.js';
import { Pickup } from '../modules/pickups/pickup.model.js';
import { Intake, Sale } from '../modules/plant/plant.models.js';
import { materialDelCatalogo } from '../modules/materials/catalogo.js';
import { issueCertificate } from '../modules/certificates/certificate.service.js';
import { sincronizarIngresoDeRetiro, registrarIngreso, registrarVenta, registrarClasificacion, registrarRechazo } from '../modules/movimientos/movimiento.service.js';
import { anotarReferencias } from '../modules/plant/ventas.service.js';
import { nextSeq } from '../lib/counters.js';
import { runWithTenant } from '../lib/tenancy.js';
import { ENTIDADES } from './entidades.js';

const DAY = 24 * 60 * 60 * 1000;
export const emailsPrototipo = (slug) => ({ admin: `admin@${slug}.demo`, chofer: `chofer@${slug}.demo` });

/** Corrientes habilitadas: las indicadas, o las que surgen de los materiales que recibe. */
function corrientesDe(entidad, codigos) {
  if (entidad.corrientes) return entidad.corrientes;
  return [...new Set(['rsu', ...codigos.map((c) => materialDelCatalogo(c).corriente ?? 'rsu')])];
}

/**
 * Crea el prototipo `slug`. Opciones:
 *   password: contraseña de los usuarios del prototipo (obligatoria)
 *   conDatos: carga clientes, retiros, ingresos y ventas de ejemplo (default true)
 */
export async function crearPrototipo(slug, { password, conDatos = true } = {}) {
  const entidad = ENTIDADES.find((e) => e.slug === slug);
  if (!entidad) throw new Error(`No hay prototipo "${slug}". Opciones: ${ENTIDADES.map((e) => e.slug).join(', ')}`);
  if (!password) throw new Error('Falta la contraseña de los usuarios del prototipo');
  if (await Organization.exists({ 'prototipo.slug': slug })) throw new Error(`El prototipo "${slug}" ya existe`);

  const codigos = [...new Set([...entidad.materiales, 'RECH', ...(entidad.recibeMezcla ? ['MEZCLA'] : [])])];
  const org = await Organization.create({
    tipo: 'cooperativa', // en la plataforma, todo prestador del servicio opera como "cooperativa"
    nombre: entidad.nombre,
    perfil: entidad.perfil,
    jurisdiccion: { ...entidad.jurisdiccion, ciudad: entidad.ciudad },
    habilitaciones: { corrientes: corrientesDe(entidad, codigos) },
    prototipo: { slug, notas: entidad.notas, tambien: entidad.tambien },
  });
  const emails = emailsPrototipo(slug);
  const passwordHash = await User.hashPassword(password);
  const admin = await User.create({ nombre: `Admin ${entidad.nombre}`, email: emails.admin, rol: 'admin', organizacion: org._id, passwordHash });
  const chofer = await User.create({ nombre: 'Chofer de ejemplo', email: emails.chofer, rol: 'chofer', organizacion: org._id, passwordHash });

  await runWithTenant(org._id, async () => {
    const mats = await Material.insertMany(codigos.map((c) => new Material(materialDelCatalogo(c))));
    if (conDatos) await datosDeEjemplo(entidad, Object.fromEntries(mats.map((m) => [m.codigo, m])), chofer);
  });
  return { org, emails, admin };
}

/** Clientes, retiros, ingresos y ventas ficticios, con los materiales de la organización. */
async function datosDeEjemplo(entidad, m, chofer) {
  const now = Date.now();
  const propios = entidad.materiales.filter((c) => m[c] && !m[c].mezcla);
  const [comercio, industria, dependencia, comprador] = await Client.insertMany(
    [
      { razonSocial: 'Comercio de ejemplo', direcciones: [{ direccion: `Calle Ejemplo 100, ${entidad.ciudad}` }], tarifa: { modalidad: 'por_retiro', montoFijo: 12000 } },
      { razonSocial: 'Industria de ejemplo', direcciones: [{ direccion: `Parque Industrial, ${entidad.ciudad}` }], tarifa: { modalidad: 'por_kg', preciosPorKg: [] } },
      { razonSocial: 'Dependencia pública de ejemplo', direcciones: [{ alias: 'Edificio central', direccion: entidad.ciudad }, { alias: 'Escuela', direccion: entidad.ciudad }], tarifa: { modalidad: 'sin_cargo' } },
      { tipo: 'comprador', razonSocial: 'Comprador de ejemplo' },
    ].map((c) => new Client(c)),
  );

  const generadores = [comercio, industria, dependencia];
  for (let i = 0; i < 9; i++) {
    const cliente = generadores[i % 3];
    const diasAtras = 30 - i * 3;
    const pesado = diasAtras > 3;
    const items = [propios[i % propios.length], propios[(i + 1) % propios.length]]
      .filter((c, j, a) => a.indexOf(c) === j)
      .map((c, j) => ({ material: m[c]._id, pesoEstimadoKg: 40 + ((i * 17 + j * 23) % 120), ...(pesado && { pesoRealKg: 38 + ((i * 17 + j * 23) % 120) }) }));
    const sede = cliente.direcciones[i % cliente.direcciones.length];
    const p = await Pickup.create({ numero: await nextSeq('retiro'), cliente: cliente._id, direccion: sede.alias ? `${sede.alias} — ${sede.direccion}` : sede.direccion, fecha: new Date(now - diasAtras * DAY), chofer: chofer._id, estado: pesado ? 'en_planta' : 'registrado', items });
    if (pesado) await sincronizarIngresoDeRetiro(p, chofer._id);
    if (diasAtras > 8) await issueCertificate(p._id);
  }

  // Ingreso de recuperadores urbanos
  const rec = await Intake.create({ fecha: new Date(now - 5 * DAY), origen: 'recuperador', detalleOrigen: 'Recuperador urbano (ejemplo)', items: [{ material: m[propios[0]]._id, pesoKg: 120 }] });
  await registrarIngreso(rec);

  // Plantas que reciben residuos sin clasificar: un camión y su clasificación
  if (m.MEZCLA) {
    const camion = await Intake.create({ fecha: new Date(now - 4 * DAY), origen: 'recoleccion_municipal', items: [{ material: m.MEZCLA._id, pesoKg: 6000, cantidad: 1, unidad: 'camión', estimado: true }] });
    await registrarIngreso(camion);
    await registrarClasificacion({ desde: m.MEZCLA._id, items: propios.slice(0, 3).map((c, j) => ({ material: m[c]._id, kg: 400 - j * 100 })), rechazoKg: 4500, causa: 'mezclado', fecha: new Date(now - 3 * DAY) });
  }
  await registrarRechazo({ material: m[propios[0]]._id, kg: 30, fecha: new Date(now - 2 * DAY), causa: 'humedad', cliente: comercio._id, motivo: 'Material mojado (ejemplo)' });

  // Una venta: el primer material con precio de referencia se vende un poco por debajo, para mostrar el aviso
  const conRef = propios.find((c) => m[c].precioReferencia?.minKg) ?? propios[0];
  const precio = m[conRef].precioReferencia?.minKg ? Math.round(m[conRef].precioReferencia.minKg * 0.85) : 100;
  const data = { fecha: new Date(now - 6 * DAY), comprador: comprador._id, remito: 'R-0001', items: [{ material: m[conRef]._id, pesoKg: 100, precioKg: precio }], cobrada: false };
  await anotarReferencias(data);
  await registrarVenta(await Sale.create(data));
}

/** Crea todos los prototipos (por ejemplo, para la base de demostración). */
export async function crearTodos({ password, conDatos = true } = {}) {
  const creados = [];
  for (const e of ENTIDADES) creados.push(await crearPrototipo(e.slug, { password, conDatos }));
  return creados;
}
