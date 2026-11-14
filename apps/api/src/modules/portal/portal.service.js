import { Client } from '../clients/client.model.js';
import { Pickup } from '../pickups/pickup.model.js';
import { Certificate } from '../certificates/certificate.model.js';
import { Organization } from '../organizations/organization.model.js';
import { FRACCIONES } from '../materials/fracciones.js';
import { parseLocalDate, endOfLocalDay, round2, TZ_OFFSET } from '../../lib/validation.js';

// Todo lo del portal cruza cooperativas: corre con runWithoutTenant (ver portal.routes.js)
// y SIEMPRE filtra por los registros Client vinculados a la organización del usuario.

/** Registros Client de la organización en todas las cooperativas que la atienden. */
export async function clientesDeOrganizacion(orgId) {
  return Client.find({ organizacion: orgId }).select('_id coop razonSocial direcciones');
}

export function rangoAnio(anio) {
  return { desde: parseLocalDate(`${anio}-01-01`), hasta: endOfLocalDay(`${anio}-12-31`) };
}

const PESO = { $ifNull: ['$items.pesoRealKg', '$items.pesoEstimadoKg'] };

/** Impacto del año: totales, por mes, material, fracción, cooperativa y sede. */
export async function resumenAnual(orgId, anio) {
  const clientes = await clientesDeOrganizacion(orgId);
  const ids = clientes.map((c) => c._id);
  const { desde, hasta } = rangoAnio(anio);
  const match = { cliente: { $in: ids }, fecha: { $gte: desde, $lte: hasta }, estado: { $ne: 'anulado' } };

  const [items, retirosPorSede, retirosPorCoop, certs] = await Promise.all([
    Pickup.aggregate([
      { $match: match },
      { $unwind: '$items' },
      { $lookup: { from: 'materials', localField: 'items.material', foreignField: '_id', as: 'm' } },
      { $set: { m: { $first: '$m' }, kg: PESO, mes: { $month: { date: '$fecha', timezone: TZ_OFFSET } } } },
      {
        $group: {
          _id: { material: '$m.nombre', fraccion: '$m.fraccion', corriente: '$m.corriente', valorizable: '$m.valorizable', mes: '$mes', coop: '$coop', sede: '$direccion' },
          kg: { $sum: '$kg' },
          co2: { $sum: { $multiply: ['$kg', { $ifNull: ['$m.factorCo2', 0] }] } },
        },
      },
    ]).option({ sinTenant: true }),
    Pickup.aggregate([{ $match: match }, { $group: { _id: '$direccion', retiros: { $sum: 1 } } }]).option({ sinTenant: true }),
    Pickup.aggregate([{ $match: match }, { $group: { _id: '$coop', retiros: { $sum: 1 } } }]).option({ sinTenant: true }),
    Certificate.find({ cliente: { $in: ids }, fechaRetiro: { $gte: desde, $lte: hasta }, anulado: false }).select('co2EvitadoKg totalKg'),
  ]);

  const sumar = (key) => {
    const acc = new Map();
    for (const r of items) {
      const k = key(r._id);
      const a = acc.get(k) ?? { kg: 0, co2: 0 };
      a.kg += r.kg;
      a.co2 += r.co2;
      acc.set(k, a);
    }
    return acc;
  };
  const coops = new Map((await Organization.find({ _id: { $in: retirosPorCoop.map((c) => c._id) } }).select('nombre')).map((o) => [String(o._id), o.nombre]));

  const totalKg = items.reduce((a, r) => a + r.kg, 0);
  const valorizableKg = items.filter((r) => r._id.valorizable !== false).reduce((a, r) => a + r.kg, 0);
  const porMes = Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, kg: round2(sumar((k) => k.mes).get(i + 1)?.kg ?? 0) }));

  return {
    anio,
    totales: {
      retiros: retirosPorSede.reduce((a, s) => a + s.retiros, 0),
      kg: round2(totalKg),
      kgValorizable: round2(valorizableKg),
      // Del material retirado, qué porcentaje se pudo valorizar (no fue a disposición final)
      tasaValorizacion: totalKg ? round2((valorizableKg / totalKg) * 100) : null,
      co2EvitadoKg: round2(items.reduce((a, r) => a + r.co2, 0)),
      certificados: certs.length,
      co2CertificadoKg: round2(certs.reduce((a, c) => a + (c.co2EvitadoKg ?? 0), 0)),
    },
    porMes,
    porMaterial: [...sumar((k) => `${k.material}|${k.fraccion ?? ''}|${k.corriente}`)]
      .map(([k, v]) => {
        const [material, fraccion, corriente] = k.split('|');
        return { material, corriente, fraccion: fraccion ? { codigo: fraccion, ...FRACCIONES[fraccion] } : null, kg: round2(v.kg), co2EvitadoKg: round2(v.co2) };
      })
      .sort((a, b) => b.kg - a.kg),
    porFraccion: [...sumar((k) => k.fraccion ?? `corriente:${k.corriente}`)]
      .map(([k, v]) => ({ codigo: k, ...(FRACCIONES[k] ?? { nombre: k.startsWith('corriente:regu') ? 'Residuos especiales (REGU)' : k.replace('corriente:', ''), color: '—', hex: '#90a4ae' }), kg: round2(v.kg) }))
      .sort((a, b) => b.kg - a.kg),
    porCooperativa: retirosPorCoop
      .map((c) => ({ cooperativa: coops.get(String(c._id)) ?? '—', retiros: c.retiros, kg: round2(sumar((k) => String(k.coop)).get(String(c._id))?.kg ?? 0) }))
      .sort((a, b) => b.kg - a.kg),
    porSede: retirosPorSede
      .map((s) => ({ sede: s._id ?? 'Sin dirección', retiros: s.retiros, kg: round2(sumar((k) => k.sede ?? null).get(s._id ?? null)?.kg ?? 0) }))
      .sort((a, b) => b.kg - a.kg),
  };
}

/** Nombres de cooperativas por id, para mostrar quién prestó cada servicio. */
export async function nombresCooperativas(ids) {
  const orgs = await Organization.find({ _id: { $in: [...new Set(ids.map(String))] } }).select('nombre');
  return new Map(orgs.map((o) => [String(o._id), o.nombre]));
}
