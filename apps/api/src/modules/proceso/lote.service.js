// Lotes: cada ingreso abre un lote por material; cada paso registra en el libro de movimientos
// lo que corresponde (rechazo, clasificación, merma, venta), así el stock y los indicadores
// siguen al día. Las acciones de varios pasos corren dentro de una transacción (lib/transacciones.js).
import { Lote, Remito, SIGUIENTE } from './proceso.models.js';
import { Client } from '../clients/client.model.js';
import { Sale } from '../plant/plant.models.js';
import { Movimiento } from '../movimientos/movimiento.model.js';
import { registrarRechazo, registrarClasificacion, registrarVenta } from '../movimientos/movimiento.service.js';
import { anotarReferencias } from '../plant/ventas.service.js';
import { nextSeq } from '../../lib/counters.js';
import { round2 } from '../../lib/validation.js';
import { HttpError } from '../../middleware/error.js';

const ID = (v) => String(v?._id ?? v);

/** Abre un lote por cada renglón de un ingreso (lo llama registrarIngreso). */
export async function crearLotesDeIngreso(intake, usuario, cliente) {
  const lotes = [];
  for (const it of intake.items) {
    if (!(it.pesoKg > 0)) continue;
    lotes.push({
      numero: await nextSeq('lote'),
      fecha: intake.fecha ?? new Date(),
      material: it.material,
      kgIngreso: it.pesoKg,
      kg: it.pesoKg,
      estimado: Boolean(it.unidad && it.unidad !== 'kg'),
      origen: { tipo: intake.origen, cliente, ingreso: intake._id, retiro: intake.retiro },
      historial: [{ etapa: 'recepcion', usuario, kg: it.pesoKg }],
    });
  }
  if (lotes.length) await Lote.insertMany(lotes);
}

async function loteAbierto(id, etapa) {
  const lote = await Lote.findById(id).populate('material', 'nombre mezcla');
  if (!lote) throw new HttpError(404, 'Lote no encontrado');
  if (etapa && lote.etapa !== etapa) throw new HttpError(409, `El lote está en "${lote.etapa}", no en "${etapa}"`);
  return lote;
}

/**
 * Recepción → clasificado.
 *  - Material de un solo tipo: control al recibir, kg separados y rechazo (va al libro como rechazo).
 *  - Material mezclado: se clasifica en lotes nuevos por material (libro: clasificación + rechazo).
 */
export async function clasificarLote(id, d, usuario) {
  const lote = await loteAbierto(id, 'recepcion');
  const rechazo = d.kgRechazo ?? 0;
  const origenTipo = lote.origen?.tipo === 'retiro' ? undefined : lote.origen?.tipo;
  if (lote.material.mezcla) {
    if (!d.items?.length) throw new HttpError(422, 'Indicá cuánto salió de cada material');
    const total = round2(d.items.reduce((a, i) => a + i.kg, 0) + rechazo);
    if (total > lote.kg * 1.05) throw new HttpError(422, `Lo clasificado (${total} kg) supera lo que tiene el lote (${lote.kg} kg)`);
    await registrarClasificacion({ desde: lote.material._id, items: d.items, rechazoKg: rechazo, causa: d.causaRechazo, origenTipo: origenTipo ?? 'otro' }, usuario);
    const hijos = [];
    for (const i of d.items) {
      hijos.push({
        numero: await nextSeq('lote'),
        material: i.material,
        kgIngreso: i.kg,
        kg: i.kg,
        etapa: 'clasificado',
        kgSeparado: i.kg,
        origen: { tipo: 'clasificacion', cliente: lote.origen?.cliente, lote: lote._id },
        historial: [{ etapa: 'clasificado', usuario, kg: i.kg }],
      });
    }
    await Lote.insertMany(hijos);
    lote.set({ etapa: 'derivado', control: d.control ?? lote.control, humedad: d.humedad, kgRechazo: rechazo, causaRechazo: d.causaRechazo, kgSeparado: total - rechazo });
    lote.historial.push({ etapa: 'derivado', usuario, kg: 0 });
    await lote.save();
    return { lote, derivados: hijos.length };
  }
  if (d.kgSeparado == null) throw new HttpError(422, 'Indicá los kg separados para vender');
  if (d.kgSeparado + rechazo > lote.kg * 1.05) throw new HttpError(422, `Separado más rechazo (${round2(d.kgSeparado + rechazo)} kg) supera lo que tiene el lote (${lote.kg} kg)`);
  if (rechazo > 0) {
    await registrarRechazo({ material: lote.material._id, kg: rechazo, causa: d.causaRechazo, cliente: lote.origen?.cliente, origenTipo, motivo: `Rechazo del lote L-${String(lote.numero).padStart(4, '0')}` }, usuario);
  }
  lote.set({ etapa: 'clasificado', control: d.control ?? lote.control, humedad: d.humedad, kgSeparado: d.kgSeparado, kgRechazo: rechazo, causaRechazo: d.causaRechazo, kg: d.kgSeparado });
  lote.historial.push({ etapa: 'clasificado', usuario, kg: d.kgSeparado });
  await lote.save();
  return { lote };
}

/** Clasificado → enfardado: unidades y kg finales. La diferencia con lo separado es merma (ajuste en el libro). */
export async function enfardarLote(id, d, usuario) {
  const lote = await loteAbierto(id, 'clasificado');
  if (d.kgFinal > lote.kg * 1.05) throw new HttpError(422, `Los kg finales (${d.kgFinal}) superan lo que tiene el lote (${lote.kg} kg)`);
  const merma = round2(lote.kg - d.kgFinal);
  if (merma > 0) {
    await Movimiento.insertMany([{ tipo: 'ajuste', material: lote.material._id, kg: -merma, etapa: 'tratamiento', usuario, motivo: `Merma de enfardado del lote L-${String(lote.numero).padStart(4, '0')}` }]);
  }
  lote.set({ etapa: SIGUIENTE.clasificado, unidades: d.unidades, kgFinal: d.kgFinal, kg: d.kgFinal });
  lote.historial.push({ etapa: 'enfardado', usuario, kg: d.kgFinal });
  await lote.save();
  return { lote, mermaKg: Math.max(merma, 0) };
}

/** Venta de uno o varios lotes enfardados: crea la venta, el remito y cierra los lotes. */
export async function venderLotes({ comprador, fecha, items, pesaje = 'Báscula', transporte, observaciones }, usuario) {
  if (!(await Client.exists({ _id: comprador }))) throw new HttpError(422, 'Comprador inexistente');
  const lotes = await Lote.find({ _id: { $in: items.map((i) => i.lote) } });
  if (lotes.length !== new Set(items.map((i) => ID(i.lote))).size) throw new HttpError(422, 'Hay lotes que no existen');
  const porId = new Map(lotes.map((l) => [ID(l), l]));
  for (const i of items) {
    const l = porId.get(ID(i.lote));
    if (l.etapa !== 'enfardado') throw new HttpError(409, `El lote L-${String(l.numero).padStart(4, '0')} no está listo para vender (está en "${l.etapa}")`);
    if (i.kg > l.kg * 1.05) throw new HttpError(422, `Se venden más kg (${i.kg}) que los del lote L-${String(l.numero).padStart(4, '0')} (${l.kg})`);
  }
  const numero = await nextSeq('remito');
  const data = { comprador, fecha: fecha ?? new Date(), remito: `R-${String(numero).padStart(6, '0')}`, items: items.map((i) => ({ material: porId.get(ID(i.lote)).material, pesoKg: i.kg, precioKg: i.precioKg })) };
  await anotarReferencias(data);
  const venta = await Sale.create(data);
  await registrarVenta(venta, usuario);
  const remito = await Remito.create({
    numero,
    fecha: venta.fecha,
    tipo: 'venta',
    destinatario: comprador,
    items: items.map((i) => ({ material: porId.get(ID(i.lote)).material, kg: i.kg, lote: i.lote, unidades: porId.get(ID(i.lote)).unidades })),
    pesaje,
    transporte,
    observaciones,
    venta: venta._id,
  });
  for (const i of items) {
    const l = porId.get(ID(i.lote));
    l.set({ etapa: 'vendido', venta: venta._id, remito: remito._id });
    l.historial.push({ etapa: 'vendido', usuario, kg: i.kg });
    await l.save();
  }
  return { venta, remito };
}

