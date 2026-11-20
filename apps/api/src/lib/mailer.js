// Envío de emails transaccionales. Sin SMTP_HOST configurado, el mail se loguea en consola
// y la función devuelve enviado=false, para que el que llame sepa que debe pasarlo por otro canal.
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const transport = env.smtp.host
  ? nodemailer.createTransport({ host: env.smtp.host, port: env.smtp.port, auth: { user: env.smtp.user, pass: env.smtp.pass } })
  : nodemailer.createTransport({ jsonTransport: true });

export async function enviarMail({ to, subject, text, html }) {
  const info = await transport.sendMail({ from: env.smtp.from, to, subject, text, html: html ?? `<pre style="font-family:system-ui,sans-serif;white-space:pre-wrap">${text}</pre>` });
  if (!env.smtp.host) {
    if (env.nodeEnv !== 'test') console.log(`[mail simulado] para ${to}: ${subject}\n${text}`);
    return { enviado: false };
  }
  return { enviado: true, messageId: info.messageId };
}

/** Invitación para el admin de una organización piloto. */
export async function mandarInvitacionPiloto({ to, nombre, orgNombre, password, urlWeb }) {
  const subject = `Bienvenido a Gestión RSU — ${orgNombre}`;
  const text =
    `Hola ${nombre.split(' ')[0] || ''},\n\n` +
    `Te creamos una cuenta en Gestión RSU para ${orgNombre}.\n\n` +
    `  Entrar:      ${urlWeb}/login\n` +
    `  Usuario:     ${to}\n` +
    `  Contraseña:  ${password}  ← temporal, al entrar te pide una nueva\n\n` +
    `Al entrar por primera vez vas a:\n` +
    `  1. Cambiar la contraseña por una propia.\n` +
    `  2. Completar los datos fiscales de tu organización.\n\n` +
    `Si algo no te cierra, escribinos por WhatsApp: +54 9 343 525-4141.\n\n` +
    `Gestión RSU — Nueva Vida`;
  return enviarMail({ to, subject, text });
}
