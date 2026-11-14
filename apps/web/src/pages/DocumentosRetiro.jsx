import { useState } from 'react';
import { apiForm, openPdf } from '../api.js';

export const TIPOS_DOCUMENTO = { remito: 'Remito', ticket_pesaje: 'Ticket de pesaje', factura: 'Factura', manifiesto: 'Manifiesto', otro: 'Documento' };

/**
 * Documentos que respaldan el traslado (remito, ticket de pesaje, factura…).
 * `base`: ruta de descarga sin el id del documento, p. ej. `/retiros/<id>/documentos`
 * o `/v1/portal/retiros/<id>/documentos`. `onUploaded` habilita la subida.
 */
export function DocumentosRetiro({ documentos = [], base, onUploaded }) {
  const [tipo, setTipo] = useState('remito');
  const [err, setErr] = useState(null);
  const [subiendo, setSubiendo] = useState(false);

  async function subir(file) {
    if (!file) return;
    setErr(null);
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) return setErr('Subí un PDF, JPG o PNG.');
    if (file.size > 5 * 1024 * 1024) return setErr('El archivo tiene que pesar menos de 5 MB.');
    const fd = new FormData();
    fd.append('tipo', tipo);
    fd.append('archivo', file);
    setSubiendo(true);
    try {
      await apiForm(base, fd);
      await onUploaded();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSubiendo(false);
    }
  }

  const abrir = (d) => openPdf(`${base}/${d._id ?? d.id}`).catch((e) => setErr(e.message));

  return (
    <div className="docs">
      {documentos.map((d) => (
        <button key={d._id ?? d.id} type="button" className="link doc-link" onClick={() => abrir(d)} title={d.nombre}>
          📄 {TIPOS_DOCUMENTO[d.tipo] ?? 'Documento'}{d.numero ? ` ${d.numero}` : ''}
        </button>
      ))}
      {onUploaded && (
        <span className="doc-upload">
          <select aria-label="Tipo de documento" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {Object.entries(TIPOS_DOCUMENTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <label className="button secondary sm">
            {subiendo ? 'Subiendo…' : 'Adjuntar'}
            <input type="file" accept="application/pdf,image/png,image/jpeg" hidden disabled={subiendo} onChange={(e) => { subir(e.target.files[0]); e.target.value = ''; }} />
          </label>
        </span>
      )}
      {err && <span className="error small">{err}</span>}
    </div>
  );
}
