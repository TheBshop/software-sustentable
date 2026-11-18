// Convenio con el municipio: obligaciones de cada parte, cumplimiento del mes, últimos 6 meses
// y resumen de incumplimientos para presentar.
import { useState } from 'react';
import { api, getUser, isoDate } from '../../api.js';
import { useLoad, ErrorMsg, ConfirmButton } from '../../ui.jsx';
import Ayuda from '../../shell/Ayuda.jsx';

const TONO = { cumple: 'green', parcial: 'sun', no_cumple: 'red', sin_dato: 'gray' };
const mesCorto = (m) => new Date(`${m}-15`).toLocaleDateString('es-AR', { month: 'short' });
const fmt = (o, v) => (v == null || v === '' ? '—' : o.tipo === 'pago' ? `$ ${Number(v).toLocaleString('es-AR')}` : `${Number(v).toLocaleString('es-AR')}${o.unidad ? ` ${o.unidad}` : ''}`);

function Valor({ cv, o, mes, admin, onCambio }) {
  const [v, setV] = useState(o.valor ?? '');
  if (o.auto) return <span className="num">{fmt(o, o.valor)}<span className="small muted" style={{ display: 'block' }}>de los ingresos</span></span>;
  if (!admin) return <span className="num">{o.tipo === 'servicio' ? { 1: 'Sí', 0: 'No' }[o.valor] ?? '—' : fmt(o, o.valor)}</span>;
  const guardar = (val) => api(`/convenios/${cv._id}/meses/${mes}/${o.id}`, { method: 'PUT', body: { v: val === '' ? null : Number(val) } }).then(onCambio);
  if (o.tipo === 'servicio') {
    return (
      <select aria-label={`Cumplimiento: ${o.que}`} value={o.valor ?? ''} onChange={(e) => guardar(e.target.value)} style={{ width: 'auto' }}>
        <option value="">—</option>
        <option value="1">Sí</option>
        <option value="0">No</option>
      </select>
    );
  }
  return <input aria-label={`Cumplido: ${o.que}`} type="number" min="0" step="any" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => String(v) !== String(o.valor ?? '') && guardar(v)} style={{ maxWidth: 130 }} />;
}

function Nota({ cv, o, mes, admin }) {
  const [n, setN] = useState(o.nota);
  if (!admin) return <span className="small">{o.nota}</span>;
  return <input aria-label={`Nota: ${o.que}`} type="text" placeholder="Nota" value={n} onChange={(e) => setN(e.target.value)} onBlur={() => n !== o.nota && api(`/convenios/${cv._id}/meses/${mes}/${o.id}`, { method: 'PUT', body: { nota: n } })} />;
}

function Resumen({ cv, mes }) {
  const { data } = useLoad(`/convenios/${cv._id}/resumen?mes=${mes}`);
  const [copiado, setCopiado] = useState(false);
  if (!data) return null;
  if (!data.texto) return <p className="small muted">No hay incumplimientos del municipio registrados en los últimos 12 meses.</p>;
  return (
    <div className="stack">
      <textarea readOnly rows={6} value={data.texto} aria-label="Resumen de incumplimientos" style={{ width: '100%', fontFamily: 'inherit', fontSize: 13 }} />
      <div className="row">
        <button type="button" className="secondary sm" onClick={() => navigator.clipboard?.writeText(data.texto).then(() => setCopiado(true))}>Copiar</button>
        {copiado && <span className="small muted">Copiado</span>}
      </div>
    </div>
  );
}

function NuevaObligacion({ cv, tipos, onListo }) {
  const [f, setF] = useState({ parte: 'Municipio', que: '', tipo: 'cantidad', meta: '', unidad: '', auto: false });
  const [err, setErr] = useState(null);
  async function enviar(e) {
    e.preventDefault();
    setErr(null);
    try {
      await api(`/convenios/${cv._id}/obligaciones`, { method: 'POST', body: { parte: f.parte, que: f.que, tipo: f.tipo, auto: f.auto, ...(f.meta !== '' && { meta: Number(f.meta) }), ...(f.unidad && { unidad: f.unidad }) } });
      setF({ ...f, que: '', meta: '', unidad: '', auto: false });
      onListo();
    } catch (x) {
      setErr(x.message);
    }
  }
  return (
    <form className="card stack" onSubmit={enviar}>
      <h3>Agregar obligación</h3>
      <div className="form-grid">
        <label>
          Quién la cumple
          <select value={f.parte} onChange={(e) => setF({ ...f, parte: e.target.value })}>
            <option>Municipio</option>
            <option value="Organización">Nosotros</option>
          </select>
        </label>
        <label>Qué dice el convenio<input type="text" required placeholder="Ej.: entregar 200 t por mes" value={f.que} onChange={(e) => setF({ ...f, que: e.target.value })} /></label>
        <label>
          Cómo se mide
          <select value={f.tipo} disabled={f.auto} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
            {Object.entries(tipos).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        {f.tipo !== 'servicio' && <label>Pactado por mes<input type="number" min="0" step="any" required value={f.meta} onChange={(e) => setF({ ...f, meta: e.target.value })} /></label>}
        {f.tipo === 'cantidad' && !f.auto && <label>Unidad<input type="text" placeholder="t, viajes, personas…" value={f.unidad} onChange={(e) => setF({ ...f, unidad: e.target.value })} /></label>}
      </div>
      <label className="check"><input type="checkbox" checked={f.auto} onChange={(e) => setF({ ...f, auto: e.target.checked, tipo: 'cantidad' })} /> Calcular con los ingresos de recolección municipal (en t)</label>
      {err && <p className="error" role="alert">{err}</p>}
      <div className="row"><button type="submit" className="secondary">Agregar</button></div>
    </form>
  );
}

export default function Convenio() {
  const [mes, setMes] = useState(isoDate().slice(0, 7));
  const { data, error, reload } = useLoad(`/convenios?mes=${mes}`);
  const [nuevo, setNuevo] = useState({ nombre: '', contraparte: '' });
  const admin = ['admin', 'administracion'].includes(getUser()?.rol);
  if (error) return <ErrorMsg error={error} />;
  if (!data) return <p className="muted">Cargando…</p>;
  const cv = data.items[0];

  if (!cv) {
    return (
      <div className="stack">
        <h2>Convenio con el municipio</h2>
        <p className="muted">Cargá el convenio y sus obligaciones para seguir mes a mes qué cumple cada parte.</p>
        {admin && (
          <form className="card stack" onSubmit={(e) => { e.preventDefault(); api('/convenios', { method: 'POST', body: nuevo }).then(reload); }}>
            <div className="form-grid">
              <label>Convenio<input type="text" required placeholder="Nombre o número" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} /></label>
              <label>Con<input type="text" placeholder="Municipalidad de…" value={nuevo.contraparte} onChange={(e) => setNuevo({ ...nuevo, contraparte: e.target.value })} /></label>
            </div>
            <div className="row"><button type="submit">Crear</button></div>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="page-h">
        <div>
          <h2>{cv.nombre}<Ayuda>Cargá cada mes lo que cumplió cada parte. Las obligaciones de toneladas pueden calcularse solas con los ingresos de recolección municipal.</Ayuda></h2>
          <p className="muted">{cv.contraparte ?? 'Convenio con el municipio'}</p>
        </div>
        <label className="row small">Mes<input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} style={{ width: 'auto' }} /></label>
      </div>
      <div className="card flush table-wrap">
        <table>
          <thead><tr><th>Quién</th><th>Obligación</th><th className="r">Pactado</th><th>Este mes</th><th>Estado</th><th>Últimos 6 meses</th><th>Nota</th>{admin && <th />}</tr></thead>
          <tbody>
            {cv.obligaciones.map((o) => (
              <tr key={`${o.id}-${mes}`}>
                <td><span className={`tag ${o.parte === 'Municipio' ? 'gray' : 'green'}`}>{o.parte === 'Municipio' ? 'Municipio' : 'Nosotros'}</span></td>
                <td>{o.que}</td>
                <td className="r num">{o.tipo === 'servicio' ? '—' : fmt(o, o.meta)}</td>
                <td><Valor cv={cv} o={o} mes={mes} admin={admin} onCambio={reload} /></td>
                <td><span className={`tag ${TONO[o.estado]}`}>{data.estados[o.estado]}</span></td>
                <td><span className="row" style={{ gap: 3 }}>{o.historial.map((h) => <span key={h.mes} className={`tag ${TONO[h.estado]}`} title={`${h.mes}: ${data.estados[h.estado]}`}>{mesCorto(h.mes)}</span>)}</span></td>
                <td><Nota cv={cv} o={o} mes={mes} admin={admin} /></td>
                {admin && <td><ConfirmButton onConfirm={() => api(`/convenios/${cv._id}/obligaciones/${o.id}`, { method: 'DELETE' }).then(reload)}>Quitar</ConfirmButton></td>}
              </tr>
            ))}
            {!cv.obligaciones.length && <tr><td colSpan={8} className="muted">Cargá las obligaciones del convenio abajo.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="grid2">
        {admin && <NuevaObligacion cv={cv} tipos={data.tipos} onListo={reload} />}
        <section className="card stack">
          <h3>Para presentar al municipio</h3>
          <Resumen key={`${mes}-${cv.updatedAt}`} cv={cv} mes={mes} />
        </section>
      </div>
    </div>
  );
}
