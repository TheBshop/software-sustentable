// Servicio de facturación electrónica AFIP. Orquesta WSAA + WSFE y persiste el comprobante.
// Modo por defecto: 'mock' (desarrollo y pruebas). Para producción, la organización debe
// cargar su certificado y cambiar `configuracion.afip.modo` a 'afip'.
import { Organization } from '../organizations/organization.model.js';
import { Invoice } from '../invoices/invoice.model.js';
import { currentTenant } from '../../lib/tenancy.js';
import { round2 } from '../../lib/validation.js';
import { HttpError } from '../../middleware/error.js';
import { enTransaccion } from '../../lib/transacciones.js';
import { ComprobanteAfip, TIPOS_CBTE, fmtComprobante } from './comprobante.model.js';
import { obtenerTA } from './wsaa.js';
import { solicitarCae } from './wsfe.js';

/** Config AFIP de la organización, con defaults seguros. */
export async function configAfip(org) {
  const c = org.configuracion?.afip ?? {};
  return {
    modo: c.modo ?? 'mock',
    entorno: c.entorno ?? 'homologacion',
    cuitEmisor: c.cuitEmisor ?? org.cuit ?? '20111111112',
    ptoVta: c.ptoVta ?? 1,
    condIvaEmisor: c.condIvaEmisor ?? 'monotributo', // cooperativas suelen Factura C o E
    // cert y key quedan en disco o en un secrets manager, no en la DB
  };
}

/** Qué tipo de factura emite la organización por defecto según su condición IVA. */
export function tipoPorDefecto(condIvaEmisor, condIvaReceptor = 5) {
  if (condIvaEmisor === 'responsable_inscripto') return condIvaReceptor === 1 ? 1 : 6; // A a RI, B a otros
  // Monotributo / exento → Factura C a nacional, E a exterior
  if ([8, 9].includes(condIvaReceptor)) return 19;
  return 11;
}

function validarMontos(d) {
  const esperado = round2(d.importeNeto + (d.importeIva ?? 0) + (d.importeExento ?? 0) + (d.importeNoGravado ?? 0) + (d.importeTributos ?? 0));
  if (Math.abs(esperado - d.importeTotal) > 0.01) {
    throw new HttpError(422, `Total ${d.importeTotal} no coincide con la suma de los conceptos (${esperado})`);
  }
}

/**
 * Emitir un comprobante: calcula el próximo número, pide CAE a AFIP (o mock) y lo guarda.
 * Devuelve el ComprobanteAfip con el CAE.
 */
export async function emitirComprobante(data, { usuario } = {}) {
  const org = await Organization.findById(currentTenant());
  if (!org) throw new HttpError(404, 'Organización no encontrada');
  const cfg = await configAfip(org);
  const tipo = data.tipo ?? tipoPorDefecto(cfg.condIvaEmisor, data.condIvaReceptor);
  if (!TIPOS_CBTE[tipo]) throw new HttpError(422, `Tipo de comprobante inválido: ${tipo}`);

  validarMontos(data);

  // Obtener TA (cache 12 h)
  await obtenerTA({ coop: String(org._id), modo: cfg.modo, cuitEmisor: cfg.cuitEmisor, entorno: cfg.entorno });

  // Pedimos el siguiente número a AFIP (fuente de verdad) y lo usamos.
  // Reintentos: si el mismo número ya existe localmente, probamos siguiente (puede pasar con reintentos).
  return await enTransaccion(async () => {
    // No usamos el 'ultimo' acá — solicitarCae lo calcula contra la DB (tenant-aware).
    const base = {
      tipo,
      ptoVta: cfg.ptoVta,
      fecha: data.fecha ?? new Date(),
      concepto: data.concepto ?? 1,
      docTipo: data.docTipo ?? 99,
      docNro: data.docNro ? String(data.docNro).replace(/\D/g, '') : '0',
      condIvaReceptor: data.condIvaReceptor ?? 5,
      receptorNombre: data.receptorNombre,
      moneda: data.moneda ?? 'PES',
      cotizacion: data.cotizacion ?? 1,
      importeNeto: round2(data.importeNeto),
      importeIva: round2(data.importeIva ?? 0),
      importeExento: round2(data.importeExento ?? 0),
      importeNoGravado: round2(data.importeNoGravado ?? 0),
      importeTributos: round2(data.importeTributos ?? 0),
      importeTotal: round2(data.importeTotal),
      iva: (data.iva ?? []).map((i) => ({ tasa: i.tasa, baseImp: round2(i.baseImp), importe: round2(i.importe) })),
      invoice: data.invoice,
    };

    const res = await solicitarCae({ ...base, modo: cfg.modo, coop: String(org._id), cuitEmisor: cfg.cuitEmisor });
    if (res.resultado !== 'A') {
      throw new HttpError(422, `AFIP rechazó el comprobante: ${res.errores.map((e) => `[${e.codigo}] ${e.msg}`).join(' | ')}`);
    }
    const comp = await ComprobanteAfip.create({
      ...base,
      numero: res.numero,
      cae: res.cae,
      caeVence: res.caeVence,
      resultado: cfg.modo === 'mock' ? 'simulado' : res.resultado,
      observaciones: res.observaciones,
      entorno: cfg.entorno,
      modo: cfg.modo,
    });
    // Si está vinculado a un Invoice, grabarle el N° de comprobante para que aparezca en la factura.
    if (data.invoice) {
      await Invoice.updateOne({ _id: data.invoice }, { $set: { comprobanteAfip: comp._id, numeroAfip: fmtComprobante(comp) } });
    }
    return comp;
  });
}
