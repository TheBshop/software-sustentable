import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { verificationUrl, validezDe } from './certificate.service.js';
import { FRACCIONES } from '../materials/fracciones.js';
import { leerArchivo } from '../../lib/storage.js';

const VERDE = '#2f7d32';
const ROJO = '#b3261e';
const CORTO = { reciclado: 'Reciclado', reuso: 'Reúso', compostaje: 'Compostaje', disposicion_final: 'Disp. final' };
/** Destino del material; los certificados viejos no tienen tratamiento. */
const destino = (m) => CORTO[m.tratamiento] ?? (m.valorizable === false ? 'Disp. final' : 'Valorización');
const fmtFecha = (d) => (d ? new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
const fmtNum = (n) => Number(n ?? 0).toLocaleString('es-AR', { maximumFractionDigits: 2 });
const fmtPesos = (n) => Number(n).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });
const MODALIDADES = { abono_mensual: 'incluido en el abono mensual', sin_cargo: 'sin cargo' };
const DOCS = { remito: 'Remito', carta_porte: 'Carta de porte', manifiesto: 'Manifiesto' };
const formatoCuit = (c) => { const d = String(c ?? '').replace(/\D/g, ''); return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d[10]}` : c ?? '—'; };

/** Imagen de firma o sello; si no se puede leer, el certificado se emite igual sin ella. */
async function imagen(url) {
  if (!url) return null;
  try {
    return await leerArchivo(url);
  } catch {
    return null;
  }
}

/**
 * Certificado verde con los 6 requisitos formales: partes, habilitaciones, traslado, detalle
 * gravimétrico, destino y proceso, y firma. Si le falta alguno, sale como "Constancia de
 * recepción" con la lista de lo que falta, para que no se use como certificado verde.
 * `mostrarCosto`: el costo del servicio solo va en el PDF de la cooperativa y del cliente.
 */
export async function renderCertificatePdf(cert, stream, { mostrarCosto = false } = {}) {
  const url = verificationUrl(cert.codigo);
  const qr = await QRCode.toBuffer(url, { margin: 1, width: 300 });
  const e = cert.emisorSnapshot ?? {};
  const [firma, sello] = await Promise.all([imagen(e.firmaUrl), imagen(e.selloUrl)]);
  const validez = validezDe(cert);
  const titulo = validez.completo ? validez.documento : 'Constancia de recepción de residuos';

  const doc = new PDFDocument({ size: 'A4', margin: 44, info: { Title: `${titulo} N° ${cert.numero}` } });
  doc.pipe(stream);
  const W = doc.page.width - 88;
  const X = 44;

  // Encabezado: operador y sus habilitaciones (requisito 2)
  doc.rect(0, 0, doc.page.width, 82).fill(VERDE);
  doc.fillColor('white').fontSize(17).text(e.nombre ?? 'Operador', X, 20, { width: W });
  const habilitaciones = [e.cuit && `CUIT ${formatoCuit(e.cuit)}`, e.inaes && `INAES ${e.inaes}`, e.habilitacionMunicipal && `Hab. municipal ${e.habilitacionMunicipal}`, e.caa && `Aptitud ambiental ${e.caa}`, e.registroProvincial && `Registro provincial ${e.registroProvincial}`].filter(Boolean);
  doc.fontSize(8.5).text(habilitaciones.join(' · ') || 'Sin habilitaciones cargadas', X, 44, { width: W });
  if (e.domicilio) doc.text(`Planta: ${e.domicilio}`, X, 58, { width: W });

  doc.fillColor('black').fontSize(15).text(titulo, X, 98, { width: W, align: 'center' });
  doc.fontSize(9).fillColor('#555').text(`N° ${String(cert.numero).padStart(6, '0')} · Código ${cert.codigo} · Emitido el ${fmtFecha(cert.createdAt)}`, { width: W, align: 'center' });
  let y = doc.y + 10;

  // 1. Partes · 3. Traslado
  const g = cert.clienteSnapshot ?? {};
  const t = cert.transportistaSnapshot ?? {};
  const fila = (label, texto) => {
    doc.font('Helvetica-Bold').fontSize(9).fillColor('black').text(label, X, y, { width: 90 });
    doc.font('Helvetica').text(texto, X + 92, y, { width: W - 92 });
    y = doc.y + 3;
  };
  fila('Generador', `${g.razonSocial ?? '—'} · CUIT ${formatoCuit(g.cuit)}${g.domicilio ? ` · ${g.domicilio}` : ''}`);
  fila('Transportista', t.razonSocial ? `${t.razonSocial} · CUIT ${formatoCuit(t.cuit)}${t.habilitacion ? ` · Hab. ${t.habilitacion}` : ''}` : '—');
  fila('Traslado', cert.traslado?.numero ? `${DOCS[cert.traslado.tipo] ?? 'Comprobante'} ${cert.traslado.numero} del ${fmtFecha(cert.traslado.fecha ?? cert.fechaRetiro)}` : `Retiro del ${fmtFecha(cert.fechaRetiro)}`);
  fila('Recepción', `${fmtFecha(cert.recepcion?.fecha ?? cert.fechaRetiro)}${cert.recepcion?.bascula ? ' · peso neto en báscula calibrada' : ' · peso no verificado en báscula calibrada'}`);

  // 4. Detalle gravimétrico por corriente
  y += 6;
  const cols = [X, X + 210, X + 280, X + 330, X + 405];
  doc.font('Helvetica-Bold').fontSize(9).text('Corriente y fracción', cols[0], y).text('Kg netos', cols[1], y).text('Op.', cols[2], y).text('Destino', cols[3], y).text('CO2e (kg)', cols[4], y);
  y += 14;
  doc.moveTo(X, y - 3).lineTo(X + W, y - 3).strokeColor('#ccc').stroke();
  doc.font('Helvetica');
  for (const m of cert.materiales) {
    const fr = FRACCIONES[m.fraccion];
    if (fr) doc.rect(cols[0], y + 1, 7, 7).fillAndStroke(fr.hex, '#999').fillColor('black');
    doc.fontSize(9).text(m.nombre + (m.pesoEstimado ? ' *' : ''), cols[0] + (fr ? 11 : 0), y, { width: 195 });
    doc.text(fmtNum(m.pesoKg), cols[1], y).text(m.operacion ?? '—', cols[2], y).text(destino(m), cols[3], y).text(fmtNum(m.co2EvitadoKg), cols[4], y);
    y += 14;
  }
  doc.moveTo(X, y).lineTo(X + W, y).stroke();
  y += 5;
  // 5. Balance de masa y proceso
  const b = cert.balance ?? { recibidoKg: cert.totalKg, recuperadoKg: cert.totalKg, rechazoKg: 0 };
  doc.font('Helvetica-Bold').text(`Recibido ${fmtNum(b.recibidoKg)} kg = recuperado ${fmtNum(b.recuperadoKg)} kg + rechazo ${fmtNum(b.rechazoKg)} kg`, X, y, { width: W });
  y = doc.y + 3;
  doc.font('Helvetica').fontSize(8.5).fillColor('#333').text(
    `Proceso: ${cert.procesos?.length ? cert.procesos.join(', ') : 'sin informar'}. El material recuperado se reinserta en la cadena productiva como materia prima; el rechazo va a un sitio de disposición final habilitado. ` +
      'Operaciones según el Anexo III de la Ley 24.051 (R: con recuperación; D: sin recuperación).',
    X, y, { width: W },
  );
  y = doc.y + 3;
  if (cert.materiales.some((m) => m.pesoEstimado)) {
    doc.text('* Peso estimado al retirar: no se verificó en báscula.', X, y, { width: W });
    y = doc.y + 3;
  }
  if (mostrarCosto && cert.costoServicio?.modalidad) {
    const c = cert.costoServicio;
    doc.fillColor('black').fontSize(9).text(`Costo del servicio: ${c.importe != null ? fmtPesos(c.importe) : MODALIDADES[c.modalidad] ?? '—'}`, X, y);
    y = doc.y + 3;
  }

  // Requisitos que faltan: este documento no es un certificado verde
  if (!validez.completo) {
    y += 4;
    doc.fillColor(ROJO).font('Helvetica-Bold').fontSize(9).text('No vale como certificado verde. Falta:', X, y, { width: W });
    doc.font('Helvetica').fontSize(8.5).text(validez.faltan.map((f) => `· ${f.texto}`).join('\n'), X, doc.y + 2, { width: W });
    y = doc.y + 4;
  }

  // QR · 6. Firma
  y = Math.min(y + 10, doc.page.height - 230);
  doc.image(qr, X, y, { width: 96 });
  doc.fillColor('black').fontSize(8.5).text('Verificá este documento escaneando el código QR:', X + 106, y + 20, { width: 180 });
  doc.fillColor(VERDE).text(url, X + 106, y + 44, { width: 180, link: url });
  const yf = y;
  if (sello) doc.image(sello, X + 290, yf, { fit: [80, 80] });
  if (firma) doc.image(firma, X + 375, yf + 6, { fit: [130, 56] });
  doc.moveTo(X + 375, yf + 66).lineTo(X + W, yf + 66).strokeColor('#999').stroke();
  doc.fillColor('black').fontSize(9).text(e.responsable ?? 'Representante legal', X + 375, yf + 70, { width: W - 375, align: 'center' });
  if (e.cargo) doc.fontSize(8).fillColor('#555').text(e.cargo, X + 375, yf + 82, { width: W - 375, align: 'center' });
  if (e.responsableTecnico) doc.fontSize(8).fillColor('#555').text(`Responsable técnico: ${e.responsableTecnico}${e.matriculaTecnico ? ` · ${e.matriculaTecnico}` : ''}`, X + 290, yf + 98, { width: W - 290, align: 'right' });

  // Pie: metodología del CO2
  const factores = [...new Map(cert.materiales.filter((m) => m.factorCo2 != null).map((m) => [m.nombre, m])).values()];
  doc.fontSize(6.5).fillColor('#777').text(
    (factores.length ? 'Factores de CO2e: ' + factores.map((m) => `${m.nombre} ${fmtNum(m.factorCo2)} kg/kg (${m.factorCo2Fuente || 'fuente no indicada'})`).join('; ') + '. ' : '') +
      'Para el generador, los kilos son dato de actividad de Alcance 3, categoría 5 del GHG Protocol; lo evitado se informa aparte. ' +
      'El generador es responsable del residuo hasta su tratamiento (Leyes 25.675 y 25.612): este certificado lo acredita solo si lo emite un operador habilitado.',
    X, doc.page.height - 74, { width: W, align: 'center' },
  );
  doc.end();
}
