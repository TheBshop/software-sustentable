import { useState } from 'react';
import { api, getUser, fmtFecha, fmtKg, fmtPeso, isoDate } from '../api.js';
import { useLoad, ErrorMsg, Tag } from '../ui.jsx';

const ESTADOS = { pendiente: ['Sin programar', 'sun'], programada: ['Programado', 'info'], realizada: ['Retirado', 'green'], no_realizada: ['No se pudo', 'red'], rechazada: ['Rechazado', 'gray'], cancelada: ['Cancelado', 'gray'] };
const SUGERENCIA = { atrasado: ['Atrasado', 'red'], toca: ['Toca ahora', 'sun'], al_dia: ['Al día', 'green'], con_pedido: ['Ya tiene pedido', 'info'] };
const n = (v, d = 1) => Number(v).toLocaleString('es-AR', { maximumFractionDigits: d });

/** Agenda de retiros: pedidos, hoja de ruta del día, retiros sugeridos e indicadores. */
export default function Agenda() {
  const [fecha, setFecha] = useState(isoDate());
  const pedidos = useLoad('/solicitudes?estado=pendiente');
  const ruta = useLoad(`/hoja-de-ruta?fecha=${fecha}`);
  const sugeridos = useLoad('/solicitudes/sugeridos');
  const choferes = useLoad('/solicitudes/choferes');
  const indicadores = useLoad(`/logistica?mes=${isoDate().slice(0, 7)}`);
  const clientes = useLoad('/clientes?limit=200');
  const [err, setErr] = useState(null);
  const recargar = () => Promise.all([pedidos.reload(), ruta.reload(), sugeridos.reload(), indicadores.reload()]);

  async function accion(fn) {
    setErr(null);
    try {
      await fn();
      await recargar();
    } catch (e) {
      setErr(e.message);
    }
  }
  const programar = (id, f, chofer) => accion(() => api(`/solicitudes/${id}`, { method: 'PATCH', body: { fechaProgramada: f, ...(chofer && { chofer }) } }));
  const rechazar = (id) => accion(() => api(`/solicitudes/${id}`, { method: 'PATCH', body: { estado: 'rechazada', motivoRechazo: 'No se puede atender en este momento' } }));
  const pedirSugerido = (s) => accion(() => api('/solicitudes', { method: 'POST', body: { cliente: s.cliente.id, sede: s.cliente.sede, origen: 'sugerencia', kgEstimados: s.kgPorRetiro, fechaProgramada: isoDate(new Date(Math.max(Date.now(), new Date(s.proximo).getTime()))) } }));

  const listaChoferes = choferes.data?.items ?? [];
  const r = ruta.data;
  const ind = indicadores.data;

  return (
    <>
      <div className="view-head">
        <div>
          <h2>Agenda de retiros</h2>
          <p className="muted">Pedidos de los clientes, hoja de ruta del día y los retiros que conviene programar.</p>
        </div>
      </div>
      <ErrorMsg error={err || pedidos.error || ruta.error} />

      <section className="card flush">
        <div className="card-head">
          <h3>Pedidos sin programar</h3>
          <span className="muted small">Llegan desde el portal de cada cliente</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Cliente</th><th>Qué hay</th><th>Prefiere</th><th>Programar</th></tr></thead>
            <tbody>
              {pedidos.data?.items.map((p) => <FilaPedido key={p._id} p={p} choferes={listaChoferes} onProgramar={programar} onRechazar={rechazar} />)}
              {pedidos.data && !pedidos.data.items.length && <tr><td colSpan={4} className="muted">No hay pedidos sin programar.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid2">
        <section className="card stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3>Hoja de ruta</h3>
            <input type="date" aria-label="Día" value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ width: 'auto' }} />
          </div>
          {r && (
            <p className="muted small">
              {r.paradas.length} parada{r.paradas.length === 1 ? '' : 's'}{r.kmEstimados ? ` · unos ${n(r.kmEstimados)} km entre paradas` : ''}. Orden sugerido por cercanía, con la ubicación de retiros anteriores.
              {r.sinUbicacion > 0 && ` ${r.sinUbicacion} sin ubicación conocida van al final.`}
            </p>
          )}
          <ol className="paradas">
            {r?.paradas.map((p) => (
              <li key={p.id} className={`parada ${p.estado}`}>
                <div>
                  <b>{p.cliente.razonSocial}</b>
                  <span className="muted small">{p.sede ?? 'Sin dirección'}{p.detalle && ` · ${p.detalle}`}{p.kgEstimados ? ` · ~${fmtKg(p.kgEstimados)}` : ''}</span>
                  <span className="muted small">{p.chofer ?? 'Sin chofer asignado'}{p.tramoKm != null && ` · ${n(p.tramoKm)} km desde la parada anterior`}</span>
                  {p.resultado && <span className="small error">{p.resultado.motivoTexto}{p.resultado.detalle && `: ${p.resultado.detalle}`}</span>}
                </div>
                <Tag tone={ESTADOS[p.estado][1]}>{ESTADOS[p.estado][0]}</Tag>
              </li>
            ))}
            {r && !r.paradas.length && <li className="muted small">No hay retiros programados para este día.</li>}
          </ol>
        </section>

        <section className="card stack">
          <h3>Nuevo pedido</h3>
          <NuevoPedido clientes={(clientes.data?.items ?? []).filter((c) => c.tipo !== 'comprador')} choferes={listaChoferes} onSaved={recargar} />
        </section>
      </div>

      <section className="card flush">
        <div className="card-head">
          <h3>Retiros sugeridos</h3>
          <span className="muted small">
            Según cada cuánto se viene retirando y cuántos kilos junta cada cliente{sugeridos.data?.kgObjetivoRetiro ? ` (carga objetivo: ${fmtKg(sugeridos.data.kgObjetivoRetiro)})` : ''}
          </span>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Cliente</th><th className="r">Kg por retiro</th><th className="r">Cada</th><th>Último</th><th>Próximo</th><th /></tr></thead>
            <tbody>
              {sugeridos.data?.items.map((s) => (
                <tr key={s.cliente.id}>
                  <td>{s.cliente.razonSocial}<div className="muted small">{s.retiros} retiros en 120 días</div></td>
                  <td className="r num">{fmtKg(s.kgPorRetiro)}</td>
                  <td className="r num">{s.intervaloSugeridoDias} días{s.intervaloSugeridoDias !== Math.round(s.intervaloActualDias) && <div className="muted small">hoy: {n(s.intervaloActualDias)}</div>}</td>
                  <td className="num">{fmtFecha(s.ultimoRetiro)}</td>
                  <td className="num">{fmtFecha(s.proximo)} <Tag tone={SUGERENCIA[s.estado][1]}>{SUGERENCIA[s.estado][0]}</Tag></td>
                  <td>{s.estado !== 'con_pedido' && <button type="button" className="secondary sm" onClick={() => pedirSugerido(s)}>Programar</button>}</td>
                </tr>
              ))}
              {sugeridos.data && !sugeridos.data.items.length && <tr><td colSpan={6} className="muted">Hace falta que cada cliente tenga al menos 3 retiros para sugerir una frecuencia.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {ind && (
        <section className="card stack">
          <h3>Recorridos del mes</h3>
          <div className="kpis">
            <div className="kpi"><span>Retiros</span><strong>{ind.retiros}</strong><span className="small">{ind.retirosPorDia ?? '—'} por día con salida</span></div>
            <div className="kpi"><span>Kilos por retiro</span><strong>{ind.kgPorRetiro == null ? '—' : fmtKg(ind.kgPorRetiro)}</strong></div>
            <div className="kpi"><span>Combustible por tonelada</span><strong>{ind.combustiblePorTonelada == null ? '—' : fmtPeso(ind.combustiblePorTonelada)}</strong><span className="small">{fmtPeso(ind.gastoCombustible)} en el mes</span></div>
            <div className={`kpi ${ind.pedidos.cumplimiento != null && ind.pedidos.cumplimiento < 90 ? 'alert' : ''}`}><span>Pedidos cumplidos</span><strong>{ind.pedidos.cumplimiento == null ? '—' : `${n(ind.pedidos.cumplimiento)} %`}</strong><span className="small">{ind.pedidos.noRealizados} no se pudieron</span></div>
          </div>
          {Object.keys(ind.pedidos.motivos).length > 0 && (
            <p className="small muted">Motivos de las visitas fallidas: {Object.entries(ind.pedidos.motivos).map(([k, v]) => `${ind.motivosTexto[k]} (${v})`).join(' · ')}</p>
          )}
          {ind.porChofer.length > 0 && (
            <table>
              <thead><tr><th>Chofer</th><th className="r">Retiros</th><th className="r">Kilos</th><th className="r">Kg por retiro</th></tr></thead>
              <tbody>{ind.porChofer.map((c) => <tr key={c.chofer}><td>{c.chofer}</td><td className="r num">{c.retiros}</td><td className="r num">{fmtKg(c.kg)}</td><td className="r num">{fmtKg(c.kgPorRetiro)}</td></tr>)}</tbody>
            </table>
          )}
        </section>
      )}

      {getUser()?.rol === 'admin' && <ConfigLogistica kg={sugeridos.data?.kgObjetivoRetiro} onSaved={recargar} />}
    </>
  );
}

function FilaPedido({ p, choferes, onProgramar, onRechazar }) {
  const [f, setF] = useState(p.fechaPreferida ? isoDate(new Date(p.fechaPreferida)) : isoDate());
  const [chofer, setChofer] = useState(choferes[0]?._id ?? '');
  return (
    <tr>
      <td>{p.cliente?.razonSocial}<div className="muted small">{p.sede}{p.origen === 'portal' && ' · pedido desde el portal'}</div></td>
      <td>{p.detalle ?? '—'}{p.kgEstimados ? <div className="muted small">~{fmtKg(p.kgEstimados)}</div> : null}</td>
      <td className="num">{p.fechaPreferida ? fmtFecha(p.fechaPreferida) : '—'}</td>
      <td>
        <div className="row">
          <input type="date" aria-label="Fecha del retiro" value={f} onChange={(e) => setF(e.target.value)} style={{ width: 'auto' }} />
          <select aria-label="Chofer" value={chofer} onChange={(e) => setChofer(e.target.value)} style={{ width: 'auto' }}>
            <option value="">Sin chofer</option>
            {choferes.map((c) => <option key={c._id} value={c._id}>{c.nombre}</option>)}
          </select>
          <button type="button" className="sm" onClick={() => onProgramar(p._id, f, chofer)}>Programar</button>
          <button type="button" className="link danger" onClick={() => onRechazar(p._id)}>Rechazar</button>
        </div>
      </td>
    </tr>
  );
}

function NuevoPedido({ clientes, choferes, onSaved }) {
  const vacio = { cliente: '', detalle: '', kgEstimados: '', fechaProgramada: isoDate(), chofer: '' };
  const [form, setForm] = useState(vacio);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  async function guardar(e) {
    e.preventDefault();
    setErr(null);
    if (!form.cliente) return setErr('Elegí el cliente.');
    const cli = clientes.find((c) => c._id === form.cliente);
    try {
      await api('/solicitudes', { method: 'POST', body: { cliente: form.cliente, sede: cli?.direcciones?.[0]?.direccion, ...(form.detalle.trim() && { detalle: form.detalle.trim() }), ...(Number(form.kgEstimados) > 0 && { kgEstimados: Number(form.kgEstimados) }), ...(form.fechaProgramada && { fechaProgramada: form.fechaProgramada }), ...(form.chofer && { chofer: form.chofer }) } });
      setForm(vacio);
      await onSaved();
    } catch (e2) {
      setErr(e2.message);
    }
  }
  return (
    <form className="stack" onSubmit={guardar}>
      <p className="muted small">Para un cliente que pidió por teléfono o WhatsApp.</p>
      <div className="form-grid">
        <label>Cliente<select value={form.cliente} onChange={set('cliente')}><option value="">Elegí…</option>{clientes.map((c) => <option key={c._id} value={c._id}>{c.razonSocial}</option>)}</select></label>
        <label>Qué hay para retirar<input value={form.detalle} onChange={set('detalle')} placeholder="8 bolsones de cartón" /></label>
        <label>Kg estimados<input type="number" min="0" step="any" value={form.kgEstimados} onChange={set('kgEstimados')} /></label>
        <label>Día<input type="date" value={form.fechaProgramada} onChange={set('fechaProgramada')} /></label>
        <label>Chofer<select value={form.chofer} onChange={set('chofer')}><option value="">Sin chofer</option>{choferes.map((c) => <option key={c._id} value={c._id}>{c.nombre}</option>)}</select></label>
      </div>
      <ErrorMsg error={err} />
      <div><button type="submit">Agregar a la agenda</button></div>
    </form>
  );
}

function ConfigLogistica({ kg, onSaved }) {
  const [form, setForm] = useState({ kg: kg ?? '', lat: '', lng: '' });
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  async function guardar(e) {
    e.preventDefault();
    setErr(null);
    try {
      const body = { kgObjetivoRetiro: form.kg === '' ? null : Number(form.kg) };
      if (form.lat !== '' && form.lng !== '') body.ubicacion = { lat: Number(form.lat), lng: Number(form.lng) };
      await api('/logistica/configuracion', { method: 'PATCH', body });
      setMsg('Guardado.');
      await onSaved();
    } catch (e2) {
      setErr(e2.message);
    }
  }
  return (
    <form className="card stack" onSubmit={guardar}>
      <h3>Configuración de los recorridos</h3>
      <div className="form-grid">
        <label>Carga objetivo por retiro (kg)<input type="number" min="0" step="any" value={form.kg} onChange={(e) => setForm({ ...form, kg: e.target.value })} placeholder="Vacío: se usa la frecuencia actual" /></label>
        <label>Ubicación de la planta: latitud<input type="number" step="any" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} placeholder="-31.7333" /></label>
        <label>Longitud<input type="number" step="any" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} placeholder="-60.5297" /></label>
      </div>
      <p className="muted small">La ubicación de la planta es el punto de partida del orden sugerido. La carga objetivo ajusta cada cuántos días conviene volver a cada cliente.</p>
      <ErrorMsg error={err} />
      {msg && <p className="ok">{msg}</p>}
      <div><button type="submit">Guardar</button></div>
    </form>
  );
}
