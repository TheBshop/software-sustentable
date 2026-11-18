// WSFE — Web Service de Facturación Electrónica de AFIP (v1).
// Operaciones usadas: FECompUltimoAutorizado (último número por tipo y pto. vta),
// FECAESolicitar (emitir un comprobante y obtener CAE), FEDummy (ping).
//
// Endpoints:
//   Producción:    https://servicios1.afip.gov.ar/wsfev1/service.asmx
//   Homologación:  https://wswhomo.afip.gov.ar/wsfev1/service.asmx
//
// Hasta que el cliente cargue su certificado, usamos modo MOCK: devuelve un CAE
// sintético, número correlativo y vencimiento a 10 días (que es lo que hace AFIP).
// El contrato del módulo es el mismo que el real, para que cambiar a modo 'afip'
// sea una decisión de configuración por organización, no de código.

import { randomInt } from 'node:crypto';
import { ComprobanteAfip } from './comprobante.model.js';

const ENDPOINTS = {
  homologacion: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx',
  produccion: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx',
};

/** Último número autorizado por tipo y punto de venta.
 *  Mock: lee el máximo persistido en la DB (idempotente, consistente por organización).
 *  El contexto de tenant filtra automáticamente por coop; no hace falta pasarla al where.
 */
export async function ultimoAutorizado({ modo = 'mock', tipo, ptoVta }) {
  if (modo === 'mock') {
    const r = await ComprobanteAfip.findOne({ tipo, ptoVta }).sort({ numero: -1 }).select('numero').lean();
    return r?.numero ?? 0;
  }
  throw new Error('WSFE real pendiente: completar FECompUltimoAutorizado contra ' + ENDPOINTS.homologacion);
}

/**
 * Solicitar CAE para un comprobante.
 * Output: { resultado: 'A'|'R', numero, cae, caeVence, observaciones:[], errores:[] }
 * Mock: siempre aprueba. Toma el siguiente número leyendo el máximo persistido en DB
 * (idempotente y correcto por organización, gracias al tenantPlugin).
 */
export async function solicitarCae(data) {
  const { modo = 'mock', tipo, ptoVta } = data;
  if (modo === 'mock') {
    const siguiente = (await ultimoAutorizado({ modo, tipo, ptoVta })) + 1;
    const caeNum = String(randomInt(10 ** 13, 10 ** 14 - 1));
    return {
      resultado: 'A',
      numero: siguiente,
      cae: caeNum,
      caeVence: new Date(Date.now() + 10 * 86400000),
      observaciones: [{ codigo: 999, msg: 'Comprobante simulado en modo mock. No tiene validez fiscal.' }],
      errores: [],
    };
  }
  throw new Error('WSFE real pendiente: completar FECAESolicitar contra ' + ENDPOINTS[data.entorno ?? 'homologacion']);
}

/** Ping del servicio. Mock siempre ok. */
export async function dummy({ modo = 'mock' } = {}) {
  if (modo === 'mock') return { app: 'OK', dbserver: 'OK', authserver: 'OK', modo: 'mock' };
  throw new Error('WSFE real pendiente: FEDummy');
}

/** Compatibilidad: en modo DB ya no hay cache a limpiar, pero el export se mantiene por los tests. */
export function limpiarUltimosMock() {}
