// Autodiagnóstico por grupos: cada pregunta se marca Sí / No / Sin responder y se puede anotar.
import { useState } from 'react';
import { api, getUser } from '../../api.js';
import { useLoad, ErrorMsg } from '../../ui.jsx';

function Pregunta({ q, onCambio, admin }) {
  const [notas, setNotas] = useState(q.notas);
  const set = (cumple) => api(`/cumplimiento/autodiagnostico/${q.id}`, { method: 'PUT', body: { cumple, notas: notas || undefined } }).then(onCambio);
  const grabarNotas = () => notas !== q.notas && api(`/cumplimiento/autodiagnostico/${q.id}`, { method: 'PUT', body: { cumple: q.cumple, notas } });
  return (
    <li className="diag-q">
      <div>
        <b>{q.pregunta}</b>
        {q.ayuda && <div className="small muted">{q.ayuda}</div>}
      </div>
      <div className="row">
        {admin ? (
          <>
            <button type="button" className={q.cumple === true ? '' : 'secondary'} onClick={() => set(true)}>Sí</button>
            <button type="button" className={q.cumple === false ? 'secondary' : 'secondary'} style={q.cumple === false ? { background: 'var(--rojo)', color: 'white', borderColor: 'var(--rojo)' } : undefined} onClick={() => set(false)}>No</button>
            {q.cumple !== null && <button type="button" className="link" onClick={() => set(null)}>Borrar</button>}
            <input type="text" placeholder="Nota" value={notas} onChange={(e) => setNotas(e.target.value)} onBlur={grabarNotas} aria-label="Nota" style={{ maxWidth: 220 }} />
          </>
        ) : (
          <span className={`tag ${q.cumple === true ? 'green' : q.cumple === false ? 'red' : 'gray'}`}>{q.cumple === true ? 'Sí' : q.cumple === false ? 'No' : 'Sin responder'}</span>
        )}
      </div>
    </li>
  );
}

export default function Autodiagnostico() {
  const { data, error, reload } = useLoad('/cumplimiento/autodiagnostico');
  const admin = ['admin', 'administracion'].includes(getUser()?.rol);
  if (error) return <ErrorMsg error={error} />;
  if (!data) return <p className="muted">Cargando…</p>;
  const r = data.resumen;
  return (
    <div className="stack">
      <div className="page-h">
        <div>
          <h2>Autodiagnóstico</h2>
          <p className="muted">{r.pct}% respondido como cumple ({r.cumple} de {r.total})</p>
        </div>
      </div>
      <div className="barra-prog" aria-hidden="true"><i style={{ width: `${r.pct}%` }} /></div>
      <div className="kpis">
        <div className="kpi"><span>Cumple</span><strong>{r.cumple}</strong></div>
        <div className="kpi mal"><span>No cumple</span><strong>{r.no}</strong></div>
        <div className="kpi"><span>Sin responder</span><strong>{r.sinResponder}</strong></div>
      </div>
      {data.grupos.map((g) => (
        <section key={g.grupo} className="card stack">
          <h3>{g.grupo}</h3>
          <ul className="diag-lista">
            {g.items.map((q) => <Pregunta key={q.id} q={q} onCambio={reload} admin={admin} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}
