// Tratamientos por corriente: etapas que hace la organización, partidas del mes con productos,
// rechazo y parámetros de control (marcados si están fuera de rango), obligaciones y documentos.
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, fmtFecha, isoDate, getUser } from '../../api.js';
import { useLoad, ErrorMsg, ConfirmButton } from '../../ui.jsx';
import Ayuda from '../../shell/Ayuda.jsx';

const fuera = (v, mn, mx) => v != null && ((mn != null && v < mn) || (mx != null && v > mx));
const rango = (mn, mx) => (mn != null && mx != null ? `${mn} a ${mx}` : mn != null ? `mín. ${mn}` : mx != null ? `máx. ${mx}` : '');
const n = (v) => (v == null ? '—' : Number(v).toLocaleString('es-AR', { maximumFractionDigits: 2 }));

function Corriente({ c, mes, onCambio }) {
  const { data, reload } = useLoad(`/tratamientos/${c.id}?mes=${mes}`);
  const vacio = { fecha: mes === isoDate().slice(0, 7) ? isoDate() : `${mes}-01`, lote: '', entrada: '', rechazo: '', salidas: {}, params: {} };
  const [f, setF] = useState(vacio);
  const [msg, setMsg] = useState(null);
  const rol = getUser()?.rol;
  const carga = ['admin', 'administracion', 'operador_planta'].includes(rol);
  const ind = c.indicadores;

  async function agregar(e) {
    e.preventDefault();
    setMsg(null);
    const nums = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '').map(([k, v]) => [k, Number(v)]));
    try {
      const r = await api(`/tratamientos/${c.id}`, { method: 'POST', body: { fecha: f.fecha, lote: f.lote || undefined, entrada: Number(f.entrada), rechazo: f.rechazo === '' ? undefined : Number(f.rechazo), salidas: nums(f.salidas), params: nums(f.params) } });
      setF({ ...vacio, fecha: f.fecha });
      setMsg(r.avisos.length ? { tono: 'sun', texto: `Guardada. ${r.avisos.join('. ')}.` } : { tono: 'info', texto: 'Partida guardada.' });
      reload();
      onCambio();
    } catch (x) {
      setMsg({ tono: 'red', texto: x.message });
    }
  }
  async function etapa(i, on) {
    const etapas = on ? [...c.etapasHechas, i] : c.etapasHechas.filter((x) => x !== i);
    await api(`/tratamientos/${c.id}/etapas`, { method: 'PUT', body: { etapas } });
    onCambio();
  }

  return (
    <div className="stack">
      <div className="page-h">
        <div>
          <h2>{c.n}</h2>
          <p className="muted">{c.sub} · Operación {c.op} (Ley 24.051, Anexo III)</p>
        </div>
      </div>
      {c.reg && <div className="aviso sun"><span>{c.reg}</span></div>}
      <div className="kpis">
        <div className="kpi"><span>Entró en el mes</span><strong>{n(ind.entrada)} kg</strong></div>
        <div className="kpi"><span>Salió como producto</span><strong>{n(ind.salidas)} kg</strong></div>
        <div className="kpi"><span>Rendimiento<Ayuda>Productos sobre lo que entró.</Ayuda></span><strong>{ind.rendimiento == null ? '—' : `${n(ind.rendimiento)} %`}</strong></div>
        <div className={`kpi ${ind.fueraDeRango ? 'mal' : ''}`}><span>Partidas fuera de rango</span><strong>{ind.fueraDeRango} de {ind.partidas}</strong></div>
      </div>
      <div className="grid2">
        <section className="card stack">
          <h3>Etapas que hacés</h3>
          <ol className="lista-etapas">
            {c.etapas.map((e, i) => (
              <li key={e}>
                <label className="check"><input type="checkbox" disabled={!['admin', 'administracion'].includes(rol)} checked={c.etapasHechas.includes(i)} onChange={(x) => etapa(i, x.target.checked)} /> {e}</label>
              </li>
            ))}
          </ol>
          {c.prod.length > 0 && <p className="small muted">Productos: {c.prod.join(' · ')}</p>}
        </section>
        <section className="card stack">
          <h3>Obligaciones de esta corriente</h3>
          <ul className="lista-simple">
            {c.obl.map(([t, norma, ok]) => (
              <li key={t}><span><b>{t}</b><br /><span className="small muted">{norma}</span></span>{!ok && <span className="tag sun">a verificar</span>}</li>
            ))}
          </ul>
          <p className="small muted">Documentos de cada operación: {c.docs.join(' · ')}. El estado de cada obligación se lleva en <Link to="/cumplimiento">Cumplimiento</Link>.</p>
        </section>
      </div>
      {carga && (
        <form className="card stack" onSubmit={agregar}>
          <h3>Nueva partida</h3>
          <div className="form-grid">
            <label>Fecha<input type="date" required value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></label>
            <label>Lote u origen<input type="text" value={f.lote} onChange={(e) => setF({ ...f, lote: e.target.value })} /></label>
            <label>Entró (kg)<input type="number" min="0" step="any" required value={f.entrada} onChange={(e) => setF({ ...f, entrada: e.target.value })} /></label>
            {c.prod.map((p) => (
              <label key={p}>{p} (kg)<input type="number" min="0" step="any" value={f.salidas[p] ?? ''} onChange={(e) => setF({ ...f, salidas: { ...f.salidas, [p]: e.target.value } })} /></label>
            ))}
            <label>{c.rech ?? 'Rechazo'} (kg)<input type="number" min="0" step="any" value={f.rechazo} onChange={(e) => setF({ ...f, rechazo: e.target.value })} /></label>
            {c.params.map(([k, l, u, mn, mx]) => (
              <label key={k}>
                {l}{u ? ` (${u})` : ''}{rango(mn, mx) && <span className="small muted"> · {rango(mn, mx)}</span>}
                <input type="number" step="any" value={f.params[k] ?? ''} onChange={(e) => setF({ ...f, params: { ...f.params, [k]: e.target.value } })} />
              </label>
            ))}
          </div>
          {msg && <p className={msg.tono === 'red' ? 'error' : 'small'} role="status">{msg.texto}</p>}
          <div className="row"><button type="submit">Agregar partida</button></div>
        </form>
      )}
      <div className="card flush table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th><th>Lote</th><th className="r">Entró</th>
              {c.prod.map((p) => <th key={p} className="r">{p}</th>)}
              <th className="r">{c.rech ?? 'Rechazo'}</th>
              {c.params.map(([k, l]) => <th key={k} className="r">{l}</th>)}
              {carga && <th />}
            </tr>
          </thead>
          <tbody>
            {data?.items.map((p) => (
              <tr key={p._id}>
                <td>{fmtFecha(p.fecha)}</td>
                <td>{p.lote ?? '—'}</td>
                <td className="r num">{n(p.entrada)}</td>
                {c.prod.map((pr) => <td key={pr} className="r num">{n(p.salidas[pr])}</td>)}
                <td className="r num">{n(p.rechazo)}</td>
                {c.params.map(([k, , , mn, mx]) => <td key={k} className={`r num ${fuera(p.params[k], mn, mx) ? 'error' : ''}`}>{n(p.params[k])}</td>)}
                {carga && <td><ConfirmButton onConfirm={() => api(`/tratamientos/${c.id}/${p._id}`, { method: 'DELETE' }).then(() => { reload(); onCambio(); })}>Borrar</ConfirmButton></td>}
              </tr>
            ))}
            {data && !data.items.length && <tr><td colSpan={c.prod.length + c.params.length + 5} className="muted">No hay partidas en este mes.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Tratamientos() {
  const [params, setParams] = useSearchParams();
  const [mes, setMes] = useState(isoDate().slice(0, 7));
  const { data, error, reload } = useLoad(`/tratamientos?mes=${mes}`);
  if (error) return <ErrorMsg error={error} />;
  if (!data) return <p className="muted">Cargando…</p>;
  if (!data.corrientes.length) {
    return (
      <div className="card stack">
        <h2>Tratamientos</h2>
        <p className="muted">Todavía no elegiste qué tratamientos hacés. Elegilos en el <Link to="/bienvenida">asistente de configuración</Link>.</p>
      </div>
    );
  }
  const activa = data.corrientes.find((c) => c.id === params.get('c')) ?? data.corrientes[0];
  return (
    <div className="reg-layout">
      <aside className="stack">
        <label>Mes<input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} /></label>
        <nav className="reg-lista" aria-label="Corrientes">
          {data.corrientes.map((c) => (
            <button key={c.id} type="button" className={`reg-item ${c.id === activa.id ? 'active' : ''}`} onClick={() => setParams({ c: c.id })} aria-current={c.id === activa.id ? 'true' : undefined}>
              <span>{c.n}<span className="ext" style={{ display: 'block' }}>{data.grupos[c.g]}</span></span>
              <span className={`cnt ${c.indicadores.partidas ? 'ok' : ''}`}>{c.indicadores.partidas}</span>
            </button>
          ))}
        </nav>
      </aside>
      <Corriente key={`${activa.id}-${mes}`} c={activa} mes={mes} onCambio={reload} />
    </div>
  );
}
