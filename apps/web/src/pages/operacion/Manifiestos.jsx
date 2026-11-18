// Manifiestos de traslado con QR + página pública de recepción (firma + GPS).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtFecha, fmtKg, getUser, openPdf } from '../../api.js';
import { useLoad, ErrorMsg, ConfirmButton } from '../../ui.jsx';
import Ayuda from '../../shell/Ayuda.jsx';

const TONO = { emitido: 'gray', en_transito: 'sun', recibido: 'green', anulado: 'red' };
const ETIQ = { emitido: 'Emitido', en_transito: 'En tránsito', recibido: 'Recibido', anulado: 'Anulado' };

function Anular({ id, onListo }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [err, setErr] = useState(null);
  if (!abierto) return <button type="button" className="link danger" onClick={() => setAbierto(true)}>Anular</button>;
  return (
    <form className="row" onSubmit={(e) => { e.preventDefault(); api(`/manifiestos/${id}/anular`, { method: 'POST', body: { motivo } }).then(onListo).catch((x) => setErr(x.message)); }}>
      <input type="text" required minLength={3} placeholder="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} style={{ maxWidth: 200 }} />
      <button type="submit" className="sm">Anular</button>
      <button type="button" className="link" onClick={() => setAbierto(false)}>No</button>
      {err && <span className="error small">{err}</span>}
    </form>
  );
}

export default function Manifiestos() {
  const { data, error, reload } = useLoad('/manifiestos');
  const admin = ['admin', 'administracion'].includes(getUser()?.rol);
  return (
    <div className="stack">
      <div className="page-h">
        <div>
          <h2>Manifiestos de traslado<Ayuda>Documento de cada traslado (Ley 25.612 art. 21). Lleva un QR público: el destinatario lo escanea y confirma la recepción firmando en el teléfono, con geolocalización.</Ayuda></h2>
          <p className="muted">Se emiten desde un <Link to="/comercial/remitos">remito</Link> o manualmente.</p>
        </div>
      </div>
      <ErrorMsg error={error} />
      <div className="card flush table-wrap">
        <table>
          <thead><tr><th>N°</th><th>Fecha</th><th>Destino</th><th>Corriente</th><th className="r">Kg</th><th>Estado</th><th /></tr></thead>
          <tbody>
            {data?.items.map((m) => (
              <tr key={m._id}>
                <td className="mono">{m.codigoManifiesto}</td>
                <td>{fmtFecha(m.fecha)}</td>
                <td>{m.destino?.razonSocial ?? '—'}</td>
                <td>{m.corriente ?? '—'}</td>
                <td className="r num">{fmtKg(m.kg)}</td>
                <td><span className={`tag ${TONO[m.estado]}`}>{ETIQ[m.estado]}</span>{m.estado === 'recibido' && m.recepcion && <div className="small muted">{m.recepcion.firmanteNombre}</div>}</td>
                <td className="actions">
                  <button type="button" className="secondary sm" onClick={() => openPdf(`/manifiestos/${m._id}/pdf`)}>PDF</button>
                  {m.estado === 'emitido' && admin && <button type="button" className="link" onClick={() => api(`/manifiestos/${m._id}/en-transito`, { method: 'PATCH' }).then(reload)}>Marcar en tránsito</button>}
                  {m.estado !== 'anulado' && m.estado !== 'recibido' && admin && <Anular id={m._id} onListo={reload} />}
                </td>
              </tr>
            ))}
            {data && !data.items.length && <tr><td colSpan={7} className="muted">Sin manifiestos. Emití uno desde un remito (Comercial › Remitos) o manualmente.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
