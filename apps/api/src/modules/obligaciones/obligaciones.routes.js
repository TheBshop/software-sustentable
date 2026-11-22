import { Router } from 'express';
import { Organization } from '../organizations/organization.model.js';
import { Evidencia, estadoEvidencia } from '../cumplimiento/evidencia.model.js';
import { Comprobante } from '../afip/comprobante.model.js';
import { currentTenant } from '../../lib/tenancy.js';
import { perfilDe } from '../registros/registro.model.js';

export const obligacionesRouter = Router();

const DIA = 86400000;

function semaforo(diasParaVencer) {
  if (diasParaVencer == null) return 'gris';
  if (diasParaVencer < 0) return 'rojo';
  if (diasParaVencer <= 15) return 'amarillo';
  return 'verde';
}

function proximoVencimiento(mes, dia) {
  const hoy = new Date();
  let fecha = new Date(hoy.getFullYear(), mes - 1, dia);
  if (fecha < hoy) fecha = new Date(hoy.getFullYear() + 1, mes - 1, dia);
  return fecha;
}

function vencimientoMensual(diaDelMes) {
  const hoy = new Date();
  let fecha = new Date(hoy.getFullYear(), hoy.getMonth(), diaDelMes);
  if (fecha < hoy) fecha = new Date(hoy.getFullYear(), hoy.getMonth() + 1, diaDelMes);
  return fecha;
}

function diasHasta(fecha) {
  return Math.ceil((fecha.getTime() - Date.now()) / DIA);
}

function obl(id, titulo, categoria, norma, opts = {}) {
  return { id, titulo, categoria, norma, ...opts };
}

const CATEGORIAS = {
  fiscal: 'Fiscal',
  ambiental: 'Ambiental',
  societaria: 'Societaria y laboral',
  municipal: 'Municipal',
};

obligacionesRouter.get('/', async (_req, res) => {
  const org = await Organization.findById(currentTenant()).lean();
  const perfil = perfilDe(org);
  const prov = org.jurisdiccion?.provincia;
  const evidencias = await Evidencia.find().lean();
  const porItem = new Map(evidencias.map((e) => [e.item, e]));

  const items = [];

  // --- FISCALES ---
  const cuit = org.cuit;
  const condIva = org.condicionIva;

  // IVA mensual (si es RI)
  if (condIva === 'responsable_inscripto') {
    const vence = vencimientoMensual(18);
    items.push({ ...obl('iva', 'DDJJ de IVA mensual', 'fiscal', 'Ley de IVA'), vence, dias: diasHasta(vence), semaforo: semaforo(diasHasta(vence)), automatico: false, ayuda: 'Se presenta por ARCA (ex AFIP) con el Libro IVA.' });
  }

  // DDJJ Reciclar RG 2849
  {
    const vence = vencimientoMensual(15);
    items.push({ ...obl('ddjj_reciclar', 'DDJJ Reciclar (RG 2849)', 'fiscal', 'RG ARCA 2849/2010'), vence, dias: diasHasta(vence), semaforo: semaforo(diasHasta(vence)), automatico: true, ayuda: 'Gestión RSU puede generar esta DDJJ automáticamente desde tus operaciones.', ruta: '/cumplimiento/ddjj-reciclar' });
  }

  // IIBB provincial
  {
    const vence = vencimientoMensual(20);
    items.push({ ...obl('iibb', `DDJJ Ingresos Brutos${prov ? ` (${prov})` : ''}`, 'fiscal', 'Código fiscal provincial'), vence, dias: diasHasta(vence), semaforo: semaforo(diasHasta(vence)), automatico: false, ayuda: 'Se presenta ante la Dirección de Rentas de la provincia.' });
  }

  // Facturación electrónica
  {
    const ultimoComp = await Comprobante.findOne().sort('-fecha').lean().catch(() => null);
    const tieneAfip = !!ultimoComp;
    items.push({ ...obl('facturacion', 'Facturación electrónica con CAE', 'fiscal', 'RG 4291 y modif.'), semaforo: tieneAfip ? 'verde' : 'gris', automatico: true, ayuda: tieneAfip ? 'Al día: última factura emitida.' : 'Configurá tus datos de AFIP para emitir facturas.', ruta: '/comercial/afip' });
  }

  // --- AMBIENTALES ---

  // Inscripción como operador de residuos
  {
    const ev = porItem.get('registro_operador');
    const estado = estadoEvidencia(ev);
    items.push({ ...obl('registro_operador', 'Inscripción en registro provincial de operadores', 'ambiental', 'Ley 25.612 / registro provincial'), semaforo: estado.codigo === 'cumple' ? 'verde' : estado.codigo === 'vence_pronto' ? 'amarillo' : estado.codigo === 'vencido' ? 'rojo' : 'gris', estado: estado.txt, vence: ev?.vence, dias: ev?.vence ? diasHasta(new Date(ev.vence)) : null });
  }

  // Certificado de aptitud ambiental
  {
    const caa = org.certificadoVerde?.caa;
    const ev = porItem.get('caa');
    const estado = estadoEvidencia(ev);
    items.push({ ...obl('caa', 'Certificado de aptitud ambiental', 'ambiental', 'Ley 25.675 y normas prov.'), semaforo: caa ? (estado.codigo === 'vencido' ? 'rojo' : estado.codigo === 'vence_pronto' ? 'amarillo' : 'verde') : 'gris', estado: caa ? estado.txt : 'Sin cargar', vence: ev?.vence, dias: ev?.vence ? diasHasta(new Date(ev.vence)) : null });
  }

  // Seguro ambiental
  {
    const ev = porItem.get('seguro_ambiental');
    const estado = estadoEvidencia(ev);
    items.push({ ...obl('seguro_ambiental', 'Seguro ambiental obligatorio', 'ambiental', 'Ley 25.675 art. 22'), semaforo: estado.codigo === 'cumple' ? 'verde' : estado.codigo === 'vence_pronto' ? 'amarillo' : estado.codigo === 'vencido' ? 'rojo' : 'gris', estado: estado.txt, vence: ev?.vence, dias: ev?.vence ? diasHasta(new Date(ev.vence)) : null });
  }

  // Manifiestos de transporte
  items.push({ ...obl('manifiestos', 'Manifiestos de traslado (Ley 25.612)', 'ambiental', 'Ley 25.612'), semaforo: 'verde', automatico: true, ayuda: 'Gestión RSU genera manifiestos con QR y firma digital por cada traslado.', ruta: '/operacion/manifiestos' });

  // Reporte SNIGEI
  {
    const vence = vencimientoMensual(10);
    items.push({ ...obl('snigei', 'Reporte mensual de operaciones (tipo SNIGEI)', 'ambiental', 'Ley 25.916 / normas prov.'), vence, dias: diasHasta(vence), semaforo: semaforo(diasHasta(vence)), automatico: true, ayuda: 'Se genera automáticamente desde los ingresos a planta.', ruta: '/cumplimiento/snigei' });
  }

  // --- SOCIETARIAS (solo cooperativas) ---
  if (perfil === 'cooperativa') {
    // INAES
    {
      const inaes = org.certificadoVerde?.inaes;
      items.push({ ...obl('inaes', 'Matrícula INAES vigente', 'societaria', 'Ley 20.337'), semaforo: inaes ? 'verde' : 'gris', estado: inaes ? `Matrícula ${inaes}` : 'Sin cargar' });
    }

    // Asamblea anual
    {
      const ev = porItem.get('asamblea');
      const estado = estadoEvidencia(ev);
      const vence = proximoVencimiento(12, 31);
      items.push({ ...obl('asamblea', 'Asamblea anual ordinaria', 'societaria', 'Ley 20.337 art. 47'), semaforo: estado.codigo === 'cumple' ? 'verde' : semaforo(diasHasta(vence)), estado: estado.txt, vence, dias: diasHasta(vence) });
    }

    // Balance INAES
    {
      const ev = porItem.get('balance_inaes');
      const estado = estadoEvidencia(ev);
      items.push({ ...obl('balance_inaes', 'Balance anual presentado ante INAES', 'societaria', 'Ley 20.337'), semaforo: estado.codigo === 'cumple' ? 'verde' : estado.codigo === 'vencido' ? 'rojo' : 'gris', estado: estado.txt });
    }
  }

  // ART
  {
    const ev = porItem.get('art');
    const estado = estadoEvidencia(ev);
    items.push({ ...obl('art', 'Aseguradora de Riesgos del Trabajo (ART)', 'societaria', 'Ley 24.557'), semaforo: estado.codigo === 'cumple' ? 'verde' : estado.codigo === 'vence_pronto' ? 'amarillo' : estado.codigo === 'vencido' ? 'rojo' : 'gris', estado: estado.txt, vence: ev?.vence, dias: ev?.vence ? diasHasta(new Date(ev.vence)) : null });
  }

  // --- MUNICIPALES ---
  {
    const hab = org.certificadoVerde?.habilitacionMunicipal;
    items.push({ ...obl('hab_municipal', 'Habilitación municipal del establecimiento', 'municipal', 'Ordenanzas locales'), semaforo: hab ? 'verde' : 'gris', estado: hab ? `N° ${hab}` : 'Sin cargar' });
  }

  // Báscula
  {
    const basculaVence = org.certificadoVerde?.basculaVence;
    if (basculaVence) {
      const dias = diasHasta(new Date(basculaVence));
      items.push({ ...obl('bascula', 'Calibración de báscula vigente', 'municipal', 'Normas de pesas y medidas'), semaforo: semaforo(dias), vence: basculaVence, dias });
    }
  }

  // Resumen
  const resumen = { total: items.length, verde: 0, amarillo: 0, rojo: 0, gris: 0 };
  for (const it of items) resumen[it.semaforo]++;

  res.json({ perfil, categorias: CATEGORIAS, items, resumen });
});
