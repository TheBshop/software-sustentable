// Recomendaciones automáticas para el generador (empresa o municipio), a partir de sus
// propios datos del año. Son reglas simples y explicables: cada una dice qué se observó,
// qué hacer y, cuando corresponde, qué norma aplica. Ordenadas por prioridad.

const fmt = (n) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 0 });

/**
 * @param {object} r resumen anual (portal.service.js#resumenAnual)
 * @returns {{ prioridad: 'alta'|'media'|'info', titulo: string, detalle: string, kgAfectados?: number, norma?: string }[]}
 */
export function recomendaciones(r) {
  const out = [];
  const sep = r.separacion ?? { causas: {} };
  const causas = sep.causas ?? {};
  const pct = (kg) => (sep.ingresadoKg ? (kg / sep.ingresadoKg) * 100 : 0);

  if (causas.mezclado > 0) {
    out.push({
      prioridad: pct(causas.mezclado) >= 5 ? 'alta' : 'media',
      titulo: 'Separá secos y húmedos en recipientes distintos',
      detalle: `${fmt(causas.mezclado)} kg se rechazaron por llegar mezclados con otros residuos. Un recipiente para secos (papel, cartón, plásticos, vidrio, metales) y otro para húmedos evita perder ese material.`,
      kgAfectados: causas.mezclado,
      norma: 'Ordenanza 9233 de Paraná, art. 10 (separación en origen obligatoria); no hacerlo es falta leve, con multa de 25 a 60 unidades fijas (art. 44).',
    });
  }
  if (causas.humedad > 0) {
    out.push({
      prioridad: pct(causas.humedad) >= 5 ? 'alta' : 'media',
      titulo: 'Guardá el papel y el cartón bajo techo',
      detalle: `${fmt(causas.humedad)} kg se rechazaron por humedad. El cartón mojado no se puede vender: conviene acopiarlo bajo techo, plegado y sobre un pallet hasta el retiro.`,
      kgAfectados: causas.humedad,
    });
  }
  if (causas.contaminado > 0) {
    out.push({
      prioridad: 'media',
      titulo: 'Vaciá y enjuagá los envases',
      detalle: `${fmt(causas.contaminado)} kg se rechazaron por restos de comida, aceite u otros contaminantes. Un enjuague rápido alcanza para que el envase se pueda reciclar.`,
      kgAfectados: causas.contaminado,
    });
  }
  if (causas.no_reciclable > 0) {
    out.push({
      prioridad: 'media',
      titulo: 'Revisá con compras los materiales que no se reciclan',
      detalle: `${fmt(causas.no_reciclable)} kg no se pudieron reciclar (por ejemplo envases multicapa o plásticos sin mercado). Elegir proveedores con envases reciclables reduce lo que va a relleno sanitario.`,
      kgAfectados: causas.no_reciclable,
    });
  }

  const t = r.totales ?? {};
  if (t.tasaValorizacion != null && t.tasaValorizacion < 70) {
    out.push({
      prioridad: 'alta',
      titulo: 'Bajá lo que va a disposición final',
      detalle: `Solo el ${fmt(t.tasaValorizacion)} % de lo retirado se pudo valorizar. Revisá con la cooperativa qué materiales terminan en el relleno sanitario y si hay alternativas.`,
      norma: 'Ordenanza 9233, art. 2 inc. i (disminuir la fracción de rechazo) y jerarquía de la Ley 25.916.',
    });
  }

  const tieneRegu = (r.porMaterial ?? []).some((m) => m.corriente === 'regu');
  if (t.retiros > 0 && !tieneRegu) {
    out.push({
      prioridad: 'info',
      titulo: '¿Tenés pilas, lámparas, electrónicos o aceite usado?',
      detalle: 'Son residuos de gestión diferenciada: no van con los demás. Consultá a tu cooperativa si los puede retirar y certificar por separado.',
      norma: 'Ordenanza 9233, art. 5; Res. 522/2016 (REGU).',
    });
  }

  if (sep.tasaCorrecta != null && sep.tasaCorrecta >= 95 && sep.ingresadoKg > 0) {
    out.push({
      prioridad: 'info',
      titulo: 'Buena separación en origen',
      detalle: `El ${fmt(sep.tasaCorrecta)} % de lo que entregaste llegó bien separado. Sumalo a tu reporte de sustentabilidad.`,
    });
  }

  const orden = { alta: 0, media: 1, info: 2 };
  return out.sort((a, b) => orden[a.prioridad] - orden[b.prioridad] || (b.kgAfectados ?? 0) - (a.kgAfectados ?? 0));
}
