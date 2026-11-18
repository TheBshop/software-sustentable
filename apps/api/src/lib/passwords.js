import crypto from 'node:crypto';

// Sin letras confusas (0/O, 1/l/I): fácil de dictar por teléfono o WhatsApp.
const ALFABETO = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Contraseña aleatoria de 12 caracteres (~70 bits). */
export const randomPassword = (len = 12) => Array.from(crypto.randomBytes(len), (b) => ALFABETO[b % ALFABETO.length]).join('');

export const normalizarCuit = (cuit) => String(cuit ?? '').replace(/\D/g, '');
