import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { Certificate } from './certificate.model.js';
import { Pickup, pesoEfectivo } from '../pickups/pickup.model.js';
import { nextSeq } from '../../lib/counters.js';
import { round2 } from '../../lib/validation.js';
import { HttpError } from '../../middleware/error.js';
import { env } from '../../config/env.js';
import { FRACCIONES, TRATAMIENTOS } from '../materials/fracciones.js';
import { tratamientoPorDefecto } from '../materials/material.model.js';
import { Organization } from '../organizations/organization.model.js';
import { currentTenant } from '../../lib/tenancy.js';
import { importeDeRetiro } from '../invoices/invoice.service.js';
import { validarCertificado, reglasJurisdiccion } from './certificado-verde.js';
import { operacionReciclado } from '../normativa/clasificador.js';

export const verificationUrl = (codigo) => `${env.publicWebUrl}/verificar/${codigo}`;

/** Emite (o devuelve, si ya existe) el certificado de un retiro. */
export async function issueCertificate(pickupId) {
  const pickup = await Pickup.findById(pickupId).populate('cliente').populate('items.material');
  if (!pickup) throw new HttpError(404, 'Retiro no encontrado');
  if (pickup.estado === 'anulado') throw new HttpError(409, 'No se puede certificar un retiro anulado');
  if (pickup.certificado) return Certificate.findById(pickup.certificado);

  const materiales = pickup.items.map((it) => {
    const kg = pesoEfectivo(it);
    return {
      material: it.material._id,
      nombre: it.material.nombre,
      pesoKg: kg,
      pesoEstimado: it.pesoRealKg == null,
      corriente: it.material.corriente ?? 'rsu',
      fraccion: it.material.fraccion,
      valorizable: it.material.valorizable !== false,
      tratamiento: it.material.tratamiento ?? tratamientoPorDefecto(it.material),
      operacion: operacionDe(it.material),
      co2EvitadoKg: round2(kg * (it.material.factorCo2 ?? 0)),
      factorCo2: it.material.factorCo2 ?? 0,
      factorCo2Fuente: it.material.factorCo2Fuente,
    };
  });

  const org = await Organization.findById(currentTenant());
  const cv = org?.certificadoVerde ?? {};
  const tr = cv.transporte ?? {};
  const pesadoTodo = pickup.items.every((it) => it.pesoRealKg != null);
  const basculaVigente = cv.basculaVence && new Date(cv.basculaVence) >= new Date();
  const recibidoKg = round2(materiales.reduce((a, m) => a + m.pesoKg, 0));
  const recuperadoKg = round2(materiales.filter((m) => m.valorizable).reduce((a, m) => a + m.pesoKg, 0));
  const data = {
    codigo: crypto.randomBytes(9).toString('base64url'), // 12 caracteres, ~72 bits
    numero: await nextSeq('certificado'),
    retiro: pickup._id,
    cliente: pickup.cliente._id,
    clienteSnapshot: { razonSocial: pickup.cliente.razonSocial, cuit: pickup.cliente.cuit, domicilio: pickup.direccion ?? pickup.cliente.direcciones?.[0]?.direccion },
    emisorSnapshot: {
      nombre: org?.nombre,
      cuit: org?.cuit,
      ...(org?.certificado?.toObject?.() ?? org?.certificado ?? {}),
      registros: (org?.habilitaciones?.registros ?? [])
        .filter((r) => !r.vence || r.vence >= new Date())
        .map(({ descripcion, organismo, numero }) => ({ descripcion, organismo, numero })),
      domicilio: org?.domicilio,
      perfil: org?.perfil,
      provincia: org?.jurisdiccion?.provincia,
      inaes: cv.inaes,
      habilitacionMunicipal: cv.habilitacionMunicipal,
      caa: cv.caa,
      registroProvincial: cv.registroProvincial,
      responsableTecnico: cv.responsableTecnico,
      matriculaTecnico: cv.matriculaTecnico,
    },
    transportistaSnapshot: tr.propio === false ? { razonSocial: tr.razonSocial, cuit: tr.cuit, habilitacion: tr.habilitacion } : { razonSocial: org?.nombre, cuit: org?.cuit, habilitacion: tr.habilitacion },
    // Sin documento cargado, el comprobante es el propio retiro numerado
    traslado: pickup.traslado?.numero ? { tipo: pickup.traslado.tipo, numero: pickup.traslado.numero, fecha: pickup.fecha } : { tipo: 'remito', numero: `Retiro N° ${String(pickup.numero).padStart(6, '0')}`, fecha: pickup.fecha },
    recepcion: { fecha: pickup.estado === 'en_planta' ? pickup.updatedAt : null, bascula: Boolean(pesadoTodo && basculaVigente) },
    balance: { recibidoKg, recuperadoKg, rechazoKg: round2(recibidoKg - recuperadoKg) },
    procesos: cv.procesos ?? [],
    costoServicio: { importe: importeDeRetiro(pickup, pickup.cliente), modalidad: pickup.cliente.tarifa?.modalidad },
    fechaRetiro: pickup.fecha,
    materiales,
    totalKg: round2(materiales.reduce((a, m) => a + m.pesoKg, 0)),
    co2EvitadoKg: round2(materiales.reduce((a, m) => a + m.co2EvitadoKg, 0)),
  };
  data.validez = validarCertificado(data);
  const cert = await Certificate.create(data);

  pickup.certificado = cert._id;
  await pickup.save();
  return cert;
}

/** Operación del Anexo III de la Ley 24.051 según el tratamiento del material. */
function operacionDe(m) {
  const t = m.tratamiento ?? tratamientoPorDefecto(m);
  if (t === 'disposicion_final') return 'D1';
  if (t === 'compostaje') return 'R3';
  return operacionReciclado(m.nombre, m.categoria)[0];
}

/** Validez de un certificado: la guardada al emitir, o calculada si es anterior a esta función. */
export const validezDe = (cert) => (cert.validez?.documento ? cert.validez : { ...validarCertificado(cert), documento: reglasJurisdiccion(cert.emisorSnapshot?.provincia).documento });

/** Vista pública (la que ve quien escanea el QR): sin datos internos. */
export function publicView(cert) {
  return {
    codigo: cert.codigo,
    numero: cert.numero,
    valido: !cert.anulado,
    emitidoEn: cert.createdAt,
    fechaRetiro: cert.fechaRetiro,
    generador: cert.clienteSnapshot,
    emisor: cert.emisorSnapshot,
    materiales: cert.materiales.map(({ nombre, pesoKg, pesoEstimado, co2EvitadoKg, fraccion, valorizable, factorCo2, factorCo2Fuente, tratamiento }) => ({
      factorCo2,
      factorCo2Fuente,
      nombre,
      pesoKg,
      pesoEstimado,
      co2EvitadoKg,
      fraccion: fraccion ? { codigo: fraccion, ...FRACCIONES[fraccion] } : null,
      destino: TRATAMIENTOS[tratamiento]?.split(' (')[0] ?? (valorizable === false ? 'Disposición final' : 'Valorización'),
      tratamiento,
    })),
    totalKg: cert.totalKg,
    co2EvitadoKg: cert.co2EvitadoKg,
    validez: validezDe(cert),
    transportista: cert.transportistaSnapshot,
    traslado: cert.traslado,
    balance: cert.balance,
    procesos: cert.procesos,
  };
}

// ---------- Envío ----------
// MVP sin integraciones pagas:
//  - WhatsApp: se devuelve un link wa.me con el mensaje armado; el operador lo abre y envía.
//    (Cuando haya volumen, migrar a WhatsApp Business Cloud API.)
//  - Email: SMTP (Gmail/Brevo/Resend). Sin SMTP configurado, se loguea el mail en consola.
const transport = env.smtp.host
  ? nodemailer.createTransport({ host: env.smtp.host, port: env.smtp.port, auth: { user: env.smtp.user, pass: env.smtp.pass } })
  : nodemailer.createTransport({ jsonTransport: true });

export async function sendCertificate(cert, { canal, destino }) {
  const url = verificationUrl(cert.codigo);
  const texto =
    `Hola! Te compartimos el Certificado de Disposición Sustentable N° ${cert.numero} de ${cert.emisorSnapshot?.nombre ?? 'la cooperativa'}. ` +
    `Recuperamos ${cert.totalKg} kg de materiales y evitamos ${cert.co2EvitadoKg} kg de CO2. ` +
    `Podés verlo y descargarlo acá: ${url}`;

  let result;
  if (canal === 'whatsapp') {
    const tel = destino.replace(/\D/g, '');
    result = { link: `https://wa.me/${tel}?text=${encodeURIComponent(texto)}` };
  } else {
    const info = await transport.sendMail({
      from: env.smtp.from,
      to: destino,
      subject: `Certificado de Disposición Sustentable N° ${cert.numero}`,
      text: texto,
      html: `<p>${texto.replace(url, `<a href="${url}">${url}</a>`)}</p>`,
    });
    if (!env.smtp.host && env.nodeEnv !== 'test') console.log('[mail simulado]', info.message.toString());
    result = { enviado: true };
  }

  cert.envios.push({ canal, destino });
  await cert.save();
  return result;
}
