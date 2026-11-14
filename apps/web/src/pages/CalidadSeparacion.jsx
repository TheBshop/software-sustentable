import { useState } from 'react';
import { api, fmtKg, isoDate } from '../api.js';
import { useLoad, ErrorMsg, Tag } from '../ui.jsx';

export const CAUSAS = { humedad: 'Humedad', mezclado: 'Mezclado con otros residuos', contaminado: 'Contaminado', no_reciclable: 'No reciclable', otro: 'Otro', sin_dato: 'Sin dato' };

/**
 * Cuánto se recupera de lo que entra y cuánto se pierde por mala separación, por origen.
 * Sirve para mostrarle datos al municipio y a cada generador.
 */
export function CalidadSeparacion({ refreshKey }) {
  const hoy = new Date();
  const desde = isoDate(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const { data, error } = useLoad(`/planta/calidad?desde=${desde}&k=${refreshKey}`);
  return (
    <section className="card stack">
      <div>
        <h3>Calidad de la separación (este mes)</h3>
        <p className="muted small">Qué parte de lo que entra termina en disposición final, según de dónde viene.</p>
      </div>
      <ErrorMsg error={error} />
      {data?.mezcla.ingresoMezclaKg > 0 && (
        <div className="kpis">
          <div className="kpi"><span>Recibido sin clasificar</span><strong>{fmtKg(data.mezcla.ingresoMezclaKg)}</strong></div>
          <div className="kpi green"><span>Recuperado al clasificar</span><strong>{fmtKg(data.mezcla.recuperadoKg)}</strong></div>
          <div className="kpi alert"><span>A disposición final</span><strong>{fmtKg(data.mezcla.rechazoMezclaKg)}</strong></div>
          <div className="kpi"><span>Tasa de recuperación</span><strong>{data.mezcla.tasaRecuperacion == null ? '—' : `${data.mezcla.tasaRecuperacion.toLocaleString('es-AR')} %`}</strong></div>
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Origen</th><th className="r">Ingresado</th><th className="r">Rechazado</th><th>Pérdida</th><th>Causas</th></tr></thead>
          <tbody>
            {data?.origenes.map((o) => (
              <tr key={o.origen}>
                <td>{o.origen}{o.esGenerador && <div className="muted small">Generador</div>}</td>
                <td className="r num">{fmtKg(o.ingresadoKg)}</td>
                <td className="r num">{fmtKg(o.rechazadoKg)}</td>
                <td>{o.tasaRechazo == null ? '—' : <Tag tone={o.tasaRechazo > 30 ? 'red' : o.tasaRechazo > 5 ? 'sun' : 'green'}>{o.tasaRechazo.toLocaleString('es-AR')} %</Tag>}</td>
                <td className="small muted">{Object.entries(o.causas).map(([c, kg]) => `${CAUSAS[c] ?? c}: ${fmtKg(kg)}`).join(' · ') || '—'}</td>
              </tr>
            ))}
            {!data?.origenes.length && <tr><td colSpan={5} className="muted">Todavía no hay ingresos este mes.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Clasificar lo recibido sin clasificar (camión municipal) en materiales + rechazo. */
export function FormClasificacion({ materiales, onDone, onCancel }) {
  const mezclas = materiales.filter((m) => m.mezcla);
  const recuperables = materiales.filter((m) => !m.mezcla && m.valorizable !== false);
  const [desde, setDesde] = useState(mezclas[0]?._id ?? '');
  const [kgs, setKgs] = useState({});
  const [rechazo, setRechazo] = useState('');
  const [causa, setCausa] = useState('mezclado');
  const [err, setErr] = useState(null);
  const total = Object.values(kgs).reduce((a, v) => a + (Number(v) || 0), 0);

  async function submit(e) {
    e.preventDefault();
    setErr(null);
    const items = Object.entries(kgs).filter(([, v]) => Number(v) > 0).map(([material, v]) => ({ material, kg: Number(v) }));
    if (!items.length && !(Number(rechazo) > 0)) return setErr('Cargá los kg clasificados o el rechazo.');
    try {
      await api('/planta/clasificacion', { method: 'POST', body: { desde, items, rechazoKg: Number(rechazo) || 0, causa } });
      onDone();
    } catch (e2) {
      setErr(e2.message);
    }
  }

  if (!mezclas.length) return <p className="muted">Primero creá en Materiales un material "sin clasificar" (marcá la opción "mezcla").</p>;
  return (
    <form className="stack" onSubmit={submit}>
      <label style={{ maxWidth: 320 }}>
        Clasificar desde
        <select value={desde} onChange={(e) => setDesde(e.target.value)}>
          {mezclas.map((m) => <option key={m._id} value={m._id}>{m.nombre}</option>)}
        </select>
      </label>
      <div className="form-grid">
        {recuperables.map((m) => (
          <label key={m._id}>{m.nombre} (kg)<input type="number" min="0" step="any" value={kgs[m._id] ?? ''} onChange={(e) => setKgs({ ...kgs, [m._id]: e.target.value })} /></label>
        ))}
      </div>
      <div className="form-grid">
        <label>Rechazo a disposición final (kg)<input type="number" min="0" step="any" value={rechazo} onChange={(e) => setRechazo(e.target.value)} /></label>
        <label>
          Causa del rechazo
          <select value={causa} onChange={(e) => setCausa(e.target.value)}>
            {Object.entries(CAUSAS).filter(([k]) => k !== 'sin_dato').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      </div>
      <p className="muted small">Recuperado: {fmtKg(total)} · Rechazo: {fmtKg(Number(rechazo) || 0)}</p>
      <ErrorMsg error={err} />
      <div className="row"><button type="submit">Guardar clasificación</button><button type="button" className="secondary" onClick={onCancel}>Cancelar</button></div>
    </form>
  );
}
