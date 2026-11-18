// Remitos emitidos: numeración correlativa sin saltos. No se borran: se anulan con su motivo.
import { useState } from 'react';
import { api, fmtFecha, fmtKg, getUser, openPdf } from '../../api.js';
import { useLoad, ErrorMsg } from '../../ui.jsx';
import Ayuda from '../../shell/Ayuda.jsx';

function Anular({ id, onListo }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState(null);
  if (!abierto) return <button type="button" className="link danger" onClick={() => setAbierto(true)}>Anular</button>;
  return (
    <form
      className="row"
      onSubmit={(e) => {
        e.preventDefault();
        api(`/remitos/${id}/anular`, { method: 'POST', body: { motivo } }).then(onListo).catch((x) => setError(x.message));
      }}
    >
      <input type="text" aria-label="Motivo de la anulación" placeholder="Motivo" required minLength={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} style={{ maxWidth: 200 }} />
      <button type="submit" className="sm">Anular</button>
      <button type="button" className="link" onClick={() => setAbierto(false)}>No</button>
      {error && <span className="error small">{error}</span>}
    </form>
  );
}

export default function Remitos() {
  const { data, error, reload } = useLoad('/remitos');
  const admin = ['admin', 'administracion'].includes(getUser()?.rol);
  return (
    <div className="stack">
      <div className="page-h">
        <div>
          <h2>Remitos<Ayuda>Documento de cada traslado (Ley 25.612, art. 21). Se emiten al vender lotes desde Operación › Proceso. La numeración no tiene saltos: un remito con error se anula, no se borra.</Ayuda></h2>
          <p className="muted">Emitidos al vender lotes.</p>
        </div>
      </div>
      <ErrorMsg error={error} />
      <div className="card flush table-wrap">
        <table>
          <thead><tr><th>N°</th><th>Fecha</th><th>Destinatario</th><th>Materiales</th><th className="r">Kg</th><th>Estado</th><th /></tr></thead>
          <tbody>
            {data?.items.map((r) => (
              <tr key={r._id}>
                <td className="mono">{r.codigo}</td>
                <td>{fmtFecha(r.fecha)}</td>
                <td>{r.destinatario?.razonSocial}</td>
                <td>{[...new Set(r.items.map((i) => i.material?.nombre))].join(', ')}</td>
                <td className="r num">{fmtKg(r.kg)}</td>
                <td>{r.anulado ? <span className="tag red" title={r.motivoAnulacion}>Anulado</span> : <span className="tag green">Vigente</span>}</td>
                <td className="actions">
                  <button type="button" className="secondary sm" onClick={() => openPdf(`/remitos/${r._id}/pdf`)}>PDF</button>
                  {admin && !r.anulado && <Anular id={r._id} onListo={reload} />}
                </td>
              </tr>
            ))}
            {data && !data.items.length && <tr><td colSpan={7} className="muted">Todavía no hay remitos. Se emiten al vender lotes desde Operación › Proceso.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
