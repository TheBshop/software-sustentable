import mongoose from 'mongoose';
import { Movimiento } from './movimiento.model.js';
import { Intake } from '../plant/plant.models.js';
import { Material } from '../materials/material.model.js';
import { Organization } from '../organizations/organization.model.js';
import { currentTenant } from '../../lib/tenancy.js';
import { round2 } from '../../lib/validation.js';
import { HttpError } from '../../middleware/error.js';
import { pesoEfectivo } from '../pickups/pickup.model.js';

const id = (v) => String(v?._id ?? v);

// ---------- Habilitaciones ----------

/**
 * Verifica que todos los materiales pertenezcan a corrientes que la cooperativa está
 * habilitada a gestionar (p. ej. un residuo peligroso requiere inscripción, Ley 24.051).
 */
export async function assertHabilitados(materialIds) {
  const coop = await Organization.findById(currentTenant());
  const habilitadas = coop?.habilitaciones?.corrientes ?? ['rsu'];
  const materiales = await Material.find({ _id: { $in: [...new Set(materialIds.map(id))] } });
  if (materiales.length !== new Set(materialIds.map(id)).size) throw new HttpError(422, 'Hay materiales que no existen en esta cooperativa');
  const noHabilitados = materiales.filter((m) => !habilitadas.includes(m.corriente));
  if (noHabilitados.length) {
    throw new HttpError(
      422,
      `La cooperativa no está habilitada para gestionar: ${noHabilitados.map((m) => `${m.nombre} (${m.corriente})`).join(', ')}`,
    );
  }
  return materiales;
}

export async function assertCorrienteHabilitada(corriente) {
  const coop = await Organization.findById(currentTenant());
  if (!(coop?.habilitaciones?.corrientes ?? ['rsu']).includes(corriente)) {
    throw new HttpError(422, `La cooperativa no está habilitada para la corriente "${corriente}"`);
  }
}

// ---------- Registro ----------

/** Ingreso a planta: suma stock. */
export async function registrarIngreso(intake, usuario) {
  await Movimiento.insertMany(
    intake.items.map((it) => ({
      fecha: intake.fecha,
      tipo: 'ingreso',
      material: it.material,
      kg: it.pesoKg,
      etapa: 'tratamiento',
      ref: { ingreso: intake._id, retiro: intake.retiro },
      usuario,
    })),
  );
}

/**
 * Cuando la planta pesa un retiro: crea su ingreso (la primera vez) o registra ajustes
 * por la diferencia si se corrige el peso. Así el libro nunca se reescribe.
 */
export async function sincronizarIngresoDeRetiro(pickup, usuario) {
  const pesos = new Map();
  // Un retiro anulado deja de sumar stock: los ajustes revierten lo ingresado.
  if (pickup.estado !== 'anulado') {
    for (const it of pickup.items) pesos.set(id(it.material), (pesos.get(id(it.material)) ?? 0) + pesoEfectivo(it));
  }

  const intake = await Intake.findOne({ retiro: pickup._id, origen: 'retiro' });
  if (!intake) {
    if (!pesos.size) return;
    const nuevo = await Intake.create({
      fecha: new Date(),
      origen: 'retiro',
      retiro: pickup._id,
      items: [...pesos].map(([material, kg]) => ({ material, pesoKg: round2(kg) })),
    });
    await registrarIngreso(nuevo, usuario);
    return;
  }

  const previos = new Map(intake.items.map((it) => [id(it.material), it.pesoKg]));
  const ajustes = [];
  for (const material of new Set([...pesos.keys(), ...previos.keys()])) {
    const delta = round2((pesos.get(material) ?? 0) - (previos.get(material) ?? 0));
    if (delta !== 0) {
      ajustes.push({ tipo: 'ajuste', material, kg: delta, etapa: 'tratamiento', ref: { retiro: pickup._id, ingreso: intake._id }, usuario, motivo: pickup.estado === 'anulado' ? `Anulación del retiro N° ${pickup.numero}` : `Corrección del peso del retiro N° ${pickup.numero}` });
    }
  }
  if (!ajustes.length) return;
  await Movimiento.insertMany(ajustes);
  intake.items = [...pesos].map(([material, kg]) => ({ material, pesoKg: round2(kg) }));
  await intake.save();
}

/** Venta: el material sale de planta hacia valorización (reciclado). */
export async function registrarVenta(sale, usuario) {
  await Movimiento.insertMany(
    sale.items.map((it) => ({ fecha: sale.fecha, tipo: 'venta', material: it.material, kg: -it.pesoKg, etapa: 'tratamiento', destino: 'valorizacion', ref: { venta: sale._id }, usuario })),
  );
}

/** Rechazo: material no valorizable que se envía a disposición final. */
export async function registrarRechazo({ material, kg, fecha, motivo }, usuario) {
  await assertHabilitados([material]);
  const [mov] = await Movimiento.insertMany([{ fecha: fecha ?? new Date(), tipo: 'rechazo', material, kg: -Math.abs(kg), etapa: 'disposicion_final', destino: 'disposicion_final', usuario, motivo }]);
  return mov;
}

/** Ajuste de inventario (por ejemplo, después de un conteo físico). */
export async function registrarAjuste({ material, kg, motivo }, usuario) {
  await assertHabilitados([material]);
  const [mov] = await Movimiento.insertMany([{ tipo: 'ajuste', material, kg, etapa: 'tratamiento', usuario, motivo }]);
  return mov;
}

// ---------- Consultas ----------

/** Stock actual por material = Σ movimientos. */
export async function stock() {
  const filas = await Movimiento.aggregate([
    { $group: { _id: '$material', kg: { $sum: '$kg' } } },
    { $lookup: { from: 'materials', localField: '_id', foreignField: '_id', as: 'm' } },
    { $project: { _id: 0, materialId: '$_id', material: { $first: '$m.nombre' }, fraccion: { $first: '$m.fraccion' }, corriente: { $first: '$m.corriente' }, kg: { $round: ['$kg', 2] } } },
    { $sort: { kg: -1 } },
  ]);
  return filas;
}

/**
 * Indicadores del período:
 *  - ingresadoKg: lo que entró a planta
 *  - valorizadoKg: lo que salió a reciclado (ventas)
 *  - dispuestoKg: lo que salió a disposición final (rechazos)
 *  - tasaDesvio: % de lo que salió de planta que se valorizó en vez de ir al relleno sanitario
 *  - tasaRechazo: % de lo ingresado que terminó en disposición final
 */
export async function indicadores(desde, hasta) {
  const match = { fecha: { $gte: desde, $lte: hasta } };
  const porTipo = await Movimiento.aggregate([{ $match: match }, { $group: { _id: '$tipo', kg: { $sum: '$kg' } } }]);
  const kg = Object.fromEntries(porTipo.map((t) => [t._id, Math.abs(t.kg)]));
  const ingresadoKg = round2(kg.ingreso ?? 0);
  const valorizadoKg = round2(kg.venta ?? 0);
  const dispuestoKg = round2(kg.rechazo ?? 0);
  const salidas = valorizadoKg + dispuestoKg;
  return {
    ingresadoKg,
    valorizadoKg,
    dispuestoKg,
    tasaDesvio: salidas ? round2((valorizadoKg / salidas) * 100) : null,
    tasaRechazo: ingresadoKg ? round2((dispuestoKg / ingresadoKg) * 100) : null,
  };
}

export const toObjectId = (v) => new mongoose.Types.ObjectId(id(v));
