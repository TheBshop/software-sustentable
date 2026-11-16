import { useEffect, useState } from 'react';
import { api, fmtFecha, fmtKg, isoDate } from '../../api.js';
import { useLoad, ErrorMsg, Tag } from '../../ui.jsx';

const ESTADOS = { pendiente: ['Recibido', 'sun'], programada: ['Programado', 'info'], realizada: ['Retirado', 'green'], no_realizada: ['No se pudo retirar', 'red'], rechazada: ['No se puede atender', 'gray'], cancelada: ['Cancelado', 'gray'] };

/** El cliente pide un retiro a la cooperativa y sigue sus pedidos. */
export default function PortalPedidos() {
  const org = useLoad('/v1/portal/organizacion');
  const { data, error, reload } = useLoad('/v1/portal/solicitudes');
  const servicios = org.data?.servicios ?? [];
  const [form, setForm] = useState({ cliente: '', sede: '', detalle: '', kgEstimados: '', fechaPreferida: '' });
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(null);
  const servicio = servicios.find((s) => s.cliente === form.cliente);

  useEffect(() => {
    if (servicios.length && !form.cliente) setForm((f) => ({ ...f, cliente: servicios[0].cliente, sede: servicios[0].sedes[0] ?? '' }));
  }, [servicios.length]); // eslint-disable-line react-hooks/exhaustive-deps

  async function pedir(e) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    if (form.detalle.trim().length < 2) return setErr('Contá qué hay para retirar (por ejemplo, "10 bolsones de cartón").');
    try {
      await api('/v1/portal/solicitudes', { method: 'POST', body: { cliente: form.cliente, detalle: form.detalle.trim(), ...(form.sede && { sede: form.sede }), ...(Number(form.kgEstimados) > 0 && { kgEstimados: Number(form.kgEstimados) }), ...(form.fechaPreferida && { fechaPreferida: form.fechaPreferida }) } });
      setOk('Pedido enviado. La cooperativa te va a avisar el día del retiro.');
      setForm({ ...form, detalle: '', kgEstimados: '', fechaPreferida: '' });
      await reload();
    } catch (e2) {
      setErr(e2.message);
    }
  }

  async function cancelar(id) {
    setErr(null);
    try {
      await api(`/v1/portal/solicitudes/${id}/cancelar`, { method: 'POST' });
      await reload();
    } catch (e2) {
      setErr(e2.message);
    }
  }

  return (
    <>
      <div className="view-head">
        <div>
          <h2>Pedir un retiro</h2>
          <p className="muted">Avisale a la cooperativa que tenés material para retirar. Vas a ver acá cuándo lo programan.</p>
        </div>
      </div>
      <div className="grid2">
        <form className="card stack" onSubmit={pedir}>
          <div className="form-grid">
            {servicios.length > 1 && (
              <label>Cooperativa<select value={form.cliente} onChange={(e) => { const s = servicios.find((x) => x.cliente === e.target.value); setForm({ ...form, cliente: e.target.value, sede: s?.sedes[0] ?? '' }); }}>{servicios.map((s) => <option key={s.cliente} value={s.cliente}>{s.cooperativa}</option>)}</select></label>
            )}
            {servicio?.sedes.length > 0 && (
              <label>Dónde retirar<select value={form.sede} onChange={(e) => setForm({ ...form, sede: e.target.value })}>{servicio.sedes.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
            )}
            <label>Qué hay para retirar<input value={form.detalle} onChange={(e) => setForm({ ...form, detalle: e.target.value })} placeholder="10 bolsones de cartón y 2 de botellas" /></label>
            <label>Kilos aproximados (opcional)<input type="number" min="0" step="any" value={form.kgEstimados} onChange={(e) => setForm({ ...form, kgEstimados: e.target.value })} /></label>
            <label>Día que te queda mejor (opcional)<input type="date" min={isoDate()} value={form.fechaPreferida} onChange={(e) => setForm({ ...form, fechaPreferida: e.target.value })} /></label>
          </div>
          <ErrorMsg error={err || error} />
          {ok && <p className="ok">{ok}</p>}
          <div><button type="submit" disabled={!servicios.length}>Enviar pedido</button></div>
          {org.data && !servicios.length && <p className="muted small">Tu organización todavía no tiene un servicio activo con una cooperativa.</p>}
        </form>

        <section className="card flush">
          <div className="card-head"><h3>Tus pedidos</h3></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Pedido</th><th>Estado</th><th /></tr></thead>
              <tbody>
                {data?.items.map((s) => (
                  <tr key={s.id}>
                    <td>
                      {s.detalle}{s.kgEstimados ? ` · ~${fmtKg(s.kgEstimados)}` : ''}
                      <div className="muted small">{fmtFecha(s.creado)}{servicios.length > 1 && ` · ${s.cooperativa}`}{s.sede && ` · ${s.sede}`}</div>
                    </td>
                    <td>
                      <Tag tone={ESTADOS[s.estado][1]}>{ESTADOS[s.estado][0]}</Tag>
                      {s.estado === 'programada' && s.fechaProgramada && <div className="small">para el {fmtFecha(s.fechaProgramada)}</div>}
                      {s.noRealizado && <div className="small muted">{s.noRealizado}</div>}
                      {s.motivoRechazo && <div className="small muted">{s.motivoRechazo}</div>}
                    </td>
                    <td>{['pendiente', 'programada'].includes(s.estado) && <button type="button" className="link danger" onClick={() => cancelar(s.id)}>Cancelar</button>}</td>
                  </tr>
                ))}
                {data && !data.items.length && <tr><td colSpan={3} className="muted">Todavía no pediste retiros.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
