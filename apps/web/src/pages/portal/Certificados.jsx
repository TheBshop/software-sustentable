import { useState } from 'react';
import { openPdf, fmtKg, fmtFecha, pad } from '../../api.js';
import { useLoad, ErrorMsg, Tag } from '../../ui.jsx';

export default function PortalCertificados() {
  const { data, error } = useLoad('/v1/portal/certificados');
  const [err, setErr] = useState(null);
  const items = data?.items ?? [];
  const validos = items.filter((c) => !c.anulado);

  return (
    <>
      <div className="view-head">
        <div>
          <h2>Certificados de disposición sustentable</h2>
          <p className="muted">
            {validos.length} certificados válidos · {fmtKg(validos.reduce((a, c) => a + c.totalKg, 0))} recuperados · {fmtKg(validos.reduce((a, c) => a + c.co2EvitadoKg, 0))} de CO₂ evitado
          </p>
        </div>
      </div>
      <ErrorMsg error={error || err} />
      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead><tr><th>N°</th><th>Fecha del retiro</th><th>Emitido por</th><th className="r">Kilos</th><th className="r">CO₂ evitado</th><th>Acciones</th></tr></thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td className="mono">{pad(c.numero, 6)} {c.anulado && <Tag tone="red">Anulado</Tag>}</td>
                  <td className="num">{fmtFecha(c.fechaRetiro)}</td>
                  <td className="small">{c.emisor}</td>
                  <td className="r num">{fmtKg(c.totalKg)}</td>
                  <td className="r num">{fmtKg(c.co2EvitadoKg)}</td>
                  <td>
                    <div className="actions">
                      <button type="button" className="secondary sm" onClick={() => openPdf(`/v1/portal/certificados/${c.id}/pdf`).catch((e) => setErr(e.message))}>Descargar PDF</button>
                      <a className="button secondary sm" href={`/verificar/${c.codigo}`} target="_blank" rel="noreferrer">Verificar</a>
                    </div>
                  </td>
                </tr>
              ))}
              {!items.length && <tr><td colSpan={6} className="muted">Todavía no hay certificados.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <p className="muted small">Cada certificado tiene un código QR que cualquier auditor puede escanear para comprobar que es auténtico.</p>
    </>
  );
}
