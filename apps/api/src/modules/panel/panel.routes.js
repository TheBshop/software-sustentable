// Panel de inicio: indicadores del mes, avisos y primeros pasos, según el perfil de la organización.
import { Router } from 'express';
import { Organization } from '../organizations/organization.model.js';
import { User } from '../users/user.model.js';
import { Movimiento } from '../movimientos/movimiento.model.js';
import { Sale } from '../plant/plant.models.js';
import { Pickup } from '../pickups/pickup.model.js';
import { Solicitud } from '../logistica/solicitud.model.js';
import { Material } from '../materials/material.model.js';
import { Client } from '../clients/client.model.js';
import { paymentAlerts } from '../invoices/invoice.service.js';
import { Lote } from '../proceso/proceso.models.js';
import { tareasPendientes } from '../proceso/rutinas.js';
import { Contrato, Convenio } from '../comercial/comercial.models.js';
import { Evidencia } from '../cumplimiento/evidencia.model.js';
import { avanceContrato } from '../comercial/comercial.routes.js';
import { RegistroServicio, perfilDe } from '../registros/registro.model.js';
import { currentTenant } from '../../lib/tenancy.js';
import { startOfLocalMonth, round2 } from '../../lib/validation.js';

export const panelRouter = Router();

const DIA = 86400000;
const pl = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const sumar = async (Model, match, campo) => (await Model.aggregate([{ $match: match }, { $group: { _id: null, v: { $sum: campo } } }]))[0]?.v ?? 0;
const sumarRegistro = async (registro, desde, campo, filtro = {}) => sumar(RegistroServicio, { registro, fecha: { $gte: desde }, ...filtro }, { $toDouble: `$datos.${campo}` });

/** Vencimientos de habilitaciones: vencidas (rojo) y que vencen en 30 días (amarillo). */
function avisosVencimientos(org) {
  const ahora = Date.now();
  const lista = [
    ...(org.habilitaciones?.registros ?? []).filter((r) => r.vence).map((r) => ({ que: r.descripcion, vence: r.vence })),
    ...(org.certificadoVerde?.basculaVence ? [{ que: 'Calibración de la báscula', vence: org.certificadoVerde.basculaVence }] : []),
  ];
  return lista.flatMap(({ que, vence }) => {
    const dias = Math.ceil((new Date(vence) - ahora) / DIA);
    if (dias < 0) return [{ tono: 'red', texto: `${que}: venció hace ${pl(-dias, 'día', 'días')}`, link: '/cumplimiento' }];
    if (dias <= 30) return [{ tono: 'sun', texto: `${que}: vence en ${pl(dias, 'día', 'días')}`, link: '/cumplimiento' }];
    return [];
  });
}

async function planta(desde) {
  const avisoDias = 30;
  const limite = new Date(Date.now() + avisoDias * DIA);
  const vences = await Evidencia.find({ vence: { $lte: limite } }).lean();
  const evAvisos = vences.flatMap((e) => {
    const diasQuedan = Math.ceil((new Date(e.vence).getTime() - Date.now()) / DIA);
    if (diasQuedan < 0) return [{ tono: 'red', texto: `Evidencia "${e.item}" venció hace ${pl(-diasQuedan, 'día', 'días')}`, link: '/cumplimiento' }];
    return [{ tono: 'sun', texto: `Evidencia "${e.item}" vence en ${pl(diasQuedan, 'día', 'días')}`, link: '/cumplimiento' }];
  });
  const contratos = await Contrato.find({ activo: true, hasta: { $gte: new Date(Date.now() - 30 * DIA) } }).populate('comprador', 'razonSocial').populate('material', 'nombre').lean();
  const avances = await Promise.all(contratos.map(async (c) => ({ c, a: await avanceContrato(c) })));
  const contratoAvisos = avances
    .filter(({ a }) => ['atrasado', 'vencido'].includes(a.estado))
    .map(({ c, a }) => ({ tono: a.estado === 'vencido' ? 'red' : 'sun', texto: `Contrato con ${c.comprador?.razonSocial} (${c.material?.nombre}): ${a.estado === 'vencido' ? 'venció sin completar' : 'al ritmo actual no llegás'}`, link: '/comercial/contratos' }));
  const [ingresado, rechazado, ventas, sinPesar, pedidos, cobros, tareas, lotesViejos] = await Promise.all([
    sumar(Movimiento, { tipo: 'ingreso', fecha: { $gte: desde } }, '$kg'),
    sumar(Movimiento, { tipo: 'rechazo', fecha: { $gte: desde } }, { $abs: '$kg' }),
    Sale.aggregate([{ $match: { fecha: { $gte: desde } } }, { $unwind: '$items' }, { $group: { _id: null, kg: { $sum: '$items.pesoKg' }, monto: { $sum: { $multiply: ['$items.pesoKg', '$items.precioKg'] } } } }]),
    Pickup.countDocuments({ estado: 'registrado' }),
    Solicitud.countDocuments({ estado: 'pendiente' }),
    paymentAlerts(7),
    tareasPendientes('d'),
    Lote.countDocuments({ etapa: { $in: ['recepcion', 'clasificado', 'enfardado'] }, fecha: { $lt: new Date(Date.now() - 30 * DIA) } }),
  ]);
  const v = ventas[0] ?? { kg: 0, monto: 0 };
  const rechazo = ingresado ? round2((rechazado / ingresado) * 100) : null;
  return {
    kpis: [
      { id: 'ingresado', label: 'Ingresado en el mes', valor: round2(ingresado), unidad: 'kg', link: '/operacion/planta' },
      { id: 'vendido', label: 'Vendido en el mes', valor: round2(v.kg), unidad: 'kg', link: '/comercial/ventas' },
      { id: 'ventas', label: 'Ventas del mes', valor: round2(v.monto), unidad: '$', link: '/comercial/ventas' },
      { id: 'rechazo', label: 'Rechazo', valor: rechazo, unidad: '%', tono: rechazo > 20 ? 'mal' : undefined, link: '/operacion/planta' },
    ],
    avisos: [
      ...(cobros.vencidas.length ? [{ tono: 'red', texto: `${pl(cobros.vencidas.length, 'factura vencida', 'facturas vencidas')} sin cobrar`, link: '/comercial/facturacion' }] : []),
      ...(sinPesar ? [{ tono: 'sun', texto: `${pl(sinPesar, 'retiro', 'retiros')} sin pesar`, link: '/operacion/retiros' }] : []),
      ...evAvisos,
      ...contratoAvisos,
      ...(lotesViejos ? [{ tono: 'sun', texto: `${pl(lotesViejos, 'lote abierto', 'lotes abiertos')} hace más de 30 días`, link: '/operacion/proceso' }] : []),
      ...(tareas.length ? [{ tono: 'info', texto: `${pl(tareas.length, 'tarea diaria', 'tareas diarias')} sin marcar hoy`, link: '/operacion/rutinas' }] : []),
      ...(pedidos ? [{ tono: 'info', texto: `${pl(pedidos, 'pedido de retiro pendiente', 'pedidos de retiro pendientes')}`, link: '/operacion/agenda' }] : []),
    ],
  };
}

async function municipio(desde) {
  const [toneladas, diferenciada, destinoT, rellenoT, basuralT, costo, ggNoInscriptos, basurales] = await Promise.all([
    sumarRegistro('recoleccion', desde, 't'),
    sumarRegistro('recoleccion', desde, 't', { 'datos.tipo': { $regex: '^Diferenciada' } }),
    sumarRegistro('destino', desde, 't'),
    sumarRegistro('destino', desde, 't', { 'datos.destino': 'Relleno sanitario' }),
    sumarRegistro('destino', desde, 't', { 'datos.destino': 'Basural' }),
    sumarRegistro('costos', desde, 'monto'),
    RegistroServicio.countDocuments({ registro: 'grandes', 'datos.inscripto': 'No' }),
    RegistroServicio.countDocuments({ registro: 'basurales', 'datos.estado': 'Activo' }),
  ]);
  const pct = (a, b) => (b ? round2((a / b) * 100) : null);
  const aRelleno = pct(rellenoT + basuralT, destinoT);
  return {
    kpis: [
      { id: 'toneladas', label: 'Recolectado en el mes', valor: round2(toneladas), unidad: 't', link: '/operacion/registros?r=recoleccion' },
      { id: 'diferenciada', label: 'Recolección diferenciada', valor: pct(diferenciada, toneladas), unidad: '%', link: '/operacion/registros?r=recoleccion' },
      { id: 'disposicion', label: 'A relleno o basural', valor: aRelleno, unidad: '%', tono: aRelleno > 80 ? 'mal' : undefined, link: '/operacion/registros?r=destino' },
      { id: 'costoT', label: 'Costo por tonelada', valor: toneladas && costo ? round2(costo / toneladas) : null, unidad: '$', link: '/operacion/registros?r=costos' },
    ],
    avisos: [
      ...(basuralT ? [{ tono: 'red', texto: `${round2(basuralT)} t fueron a basural este mes`, link: '/operacion/registros?r=destino' }] : []),
      ...(basurales ? [{ tono: 'sun', texto: `${pl(basurales, 'basural activo', 'basurales activos')}`, link: '/operacion/registros?r=basurales' }] : []),
      ...(ggNoInscriptos ? [{ tono: 'sun', texto: `${pl(ggNoInscriptos, 'gran generador', 'grandes generadores')} sin inscribir`, link: '/operacion/registros?r=grandes' }] : []),
    ],
  };
}

/** Primeros pasos: qué falta para tener la organización andando. */
async function pasos(org, perfil) {
  const [usuarios, materiales, clientes, registros, movimientos] = await Promise.all([
    User.countDocuments({ organizacion: org._id, activo: true }),
    perfil === 'municipio' ? 0 : Material.countDocuments(),
    perfil === 'municipio' ? 0 : Client.countDocuments(),
    RegistroServicio.countDocuments(),
    Movimiento.countDocuments(),
  ]);
  const lista = [{ id: 'configuracion', label: 'Configurar la organización', hecho: Boolean(org.configuracion?.onboarding), link: '/bienvenida' }];
  if (perfil === 'municipio') {
    for (const [id, label] of [['recoleccion', 'Cargar la recolección del mes'], ['destino', 'Cargar a dónde fue cada tonelada'], ['costos', 'Cargar los costos del servicio'], ['grandes', 'Armar el padrón de grandes generadores']]) {
      lista.push({ id, label, hecho: Boolean(await RegistroServicio.exists({ registro: id })), link: `/operacion/registros?r=${id}` });
    }
  } else {
    lista.push(
      { id: 'materiales', label: 'Cargar los materiales y sus precios', hecho: materiales > 0, link: '/comercial/materiales' },
      { id: 'clientes', label: 'Cargar clientes y proveedores', hecho: clientes > 0, link: '/comercial/clientes' },
      { id: 'registro', label: 'Hacer el primer registro', hecho: registros + movimientos > 0, link: '/operacion/registros' },
      { id: 'certificado', label: 'Completar quién firma los certificados', hecho: Boolean(org.certificado?.responsable), link: '/configuracion' },
    );
  }
  lista.push({ id: 'equipo', label: 'Sumar a tu equipo', hecho: usuarios > 1, link: '/configuracion' });
  return lista;
}

panelRouter.get('/', async (_req, res) => {
  const org = await Organization.findById(currentTenant()).lean();
  const perfil = perfilDe(org);
  const desde = startOfLocalMonth(new Date());
  const datos = perfil === 'municipio' ? await municipio(desde) : await planta(desde);
  const lista = await pasos(org, perfil);
  res.json({
    perfil,
    organizacion: { nombre: org.nombre, tipo: org.tipo, jurisdiccion: org.jurisdiccion ?? {}, configuracion: org.configuracion ?? {} },
    kpis: datos.kpis,
    avisos: [...(org.configuracion?.onboarding ? [] : [{ tono: 'info', texto: 'Completá la configuración para ver lo que te corresponde', link: '/bienvenida' }]), ...avisosVencimientos(org), ...datos.avisos],
    pasos: lista,
  });
});
