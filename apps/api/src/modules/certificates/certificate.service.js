import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { Certificate } from './certificate.model.js';
import { Pickup, pesoEfectivo } from '../pickups/pickup.model.js';
import { nextSeq } from '../../lib/counters.js';
import { round2 } from '../../lib/validation.js';
import { HttpError } from '../../middleware/error.js';
import { env } from '../../config/env.js';

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
      co2EvitadoKg: round2(kg * (it.material.factorCo2 ?? 0)),
    };
  });

  const cert = await Certificate.create({
    codigo: crypto.randomBytes(9).toString('base64url'), // 12 caracteres, ~72 bits
    numero: await nextSeq('certificado'),
    retiro: pickup._id,
    cliente: pickup.cliente._id,
    clienteSnapshot: { razonSocial: pickup.cliente.razonSocial, cuit: pickup.cliente.cuit },
    fechaRetiro: pickup.fecha,
    materiales,
    totalKg: round2(materiales.reduce((a, m) => a + m.pesoKg, 0)),
    co2EvitadoKg: round2(materiales.reduce((a, m) => a + m.co2EvitadoKg, 0)),
  });

  pickup.certificado = cert._id;
  await pickup.save();
  return cert;
}

/** Vista pública (la que ve quien escanea el QR): sin datos internos. */
export function publicView(cert) {
  return {
    codigo: cert.codigo,
    numero: cert.numero,
    valido: !cert.anulado,
    emitidoEn: cert.createdAt,
    fechaRetiro: cert.fechaRetiro,
    generador: cert.clienteSnapshot,
    materiales: cert.materiales.map(({ nombre, pesoKg, pesoEstimado, co2EvitadoKg }) => ({ nombre, pesoKg, pesoEstimado, co2EvitadoKg })),
    totalKg: cert.totalKg,
    co2EvitadoKg: cert.co2EvitadoKg,
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
    `Hola! Te compartimos el Certificado de Disposición Sustentable N° ${cert.numero} de la Cooperativa Nueva Vida. ` +
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
