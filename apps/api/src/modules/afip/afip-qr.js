// QR AFIP (RG 4.892/2020): el comprobante electrónico lleva un QR con los datos
// imprescindibles en una URL fija, codificados como JSON base64url en el parámetro `p`.
// https://www.afip.gob.ar/fe/qr/
import { Buffer } from 'node:buffer';

const BASE = 'https://www.afip.gob.ar/fe/qr/?p=';

/** Arma la URL del QR AFIP a partir del comprobante aprobado (necesita CAE). */
export function urlQrAfip({ fecha, cuitEmisor, ptoVta, tipoCmp, nroCmp, importe, moneda = 'PES', ctz = 1, tipoDocRec, nroDocRec, tipoCodAut = 'E', codAut }) {
  const d = new Date(fecha);
  const payload = {
    ver: 1,
    // UTC: una Date construida de "YYYY-MM-DD" queda en medianoche UTC; usar getUTC* para no restar un día.
    fecha: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`,
    cuit: Number(String(cuitEmisor).replace(/\D/g, '')),
    ptoVta: Number(ptoVta),
    tipoCmp: Number(tipoCmp),
    nroCmp: Number(nroCmp),
    importe: Number(importe),
    moneda,
    ctz: Number(ctz),
    tipoDocRec: Number(tipoDocRec ?? 99),
    nroDocRec: Number(String(nroDocRec ?? 0).replace(/\D/g, '')),
    tipoCodAut, // 'E' CAE, 'A' CAEA
    codAut: Number(String(codAut).replace(/\D/g, '')),
  };
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return BASE + b64;
}

/** Decodifica un QR AFIP (útil para tests). */
export function decodeQrAfip(url) {
  const b64 = url.startsWith(BASE) ? url.slice(BASE.length) : url;
  return JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
}
