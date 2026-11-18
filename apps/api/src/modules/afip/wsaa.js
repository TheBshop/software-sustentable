// WSAA — Web Service de Autenticación y Autorización de AFIP.
//
// Flujo real (producción u homologación):
//   1. Se arma un XML TRA (Ticket Request Access) con un uniqueId, generationTime y
//      expirationTime.
//   2. Se firma el TRA con el certificado digital (CMS/PKCS#7) obtenido en el portal
//      de AFIP contra el CUIT emisor.
//   3. Se envía por SOAP a https://wsaa.afip.gov.ar/ws/services/LoginCms (prod) o
//      https://wsaahomo.afip.gov.ar/ws/services/LoginCms (homologación).
//   4. AFIP devuelve un XML TA (Ticket Acceso) con token y sign, válido 12 h.
//
// Hasta que el cliente cargue su certificado, este módulo queda en modo MOCK:
// devuelve un TA sintético válido que usa el WSFE mock. Cuando se habilite modo
// 'afip' real, hay que implementar la firma CMS (recomendado: usar binario openssl
// o la librería `node-forge` sin bajar más dependencias si ya está en el proyecto).
import { randomUUID } from 'node:crypto';

const TA_EXPIRA_MS = 12 * 3600 * 1000;

/** TA mock para desarrollo. Reutilizable durante 12 h. */
export function obtenerTAMock() {
  const now = new Date();
  return {
    token: `MOCK-${randomUUID()}`,
    sign: `MOCK-SIGN-${randomUUID()}`,
    emitido: now,
    expira: new Date(now.getTime() + TA_EXPIRA_MS),
    cuitEmisor: null,
    modo: 'mock',
  };
}

/**
 * Obtener TA real contra WSAA de AFIP.
 * Requiere `cert` (PEM) y `key` (PEM) de la organización, el CUIT emisor y el entorno.
 * Pendiente de implementar hasta que el primer cliente cargue certificado.
 */
export async function obtenerTAReal(/* { cert, key, cuitEmisor, entorno = 'homologacion' } */) {
  throw new Error('WSAA real no está implementado todavía. El cliente debe cargar su certificado AFIP y activamos esta ruta.');
}

const cache = new Map(); // coop -> TA

/** Devuelve un TA válido (cacheado por 12 h) para la organización. En modo mock, lo arma. */
export async function obtenerTA({ coop, modo = 'mock', cert, key, cuitEmisor, entorno = 'homologacion' }) {
  const key_ = `${coop}:${modo}:${cuitEmisor ?? 'mock'}`;
  const cached = cache.get(key_);
  if (cached && cached.expira > new Date()) return cached;
  const ta = modo === 'mock' ? obtenerTAMock() : await obtenerTAReal({ cert, key, cuitEmisor, entorno });
  cache.set(key_, ta);
  return ta;
}

/** Utilidad para tests: limpiar la cache. */
export function limpiarCacheTA() {
  cache.clear();
}
