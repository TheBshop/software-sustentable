import { useState } from 'react';
import { api, fmtFecha, isoDate } from '../api.js';
import { useLoad, ErrorMsg, ConfirmButton, Tag } from '../ui.jsx';

const ELEMENTOS = ['guantes', 'botines', 'barbijo', 'antiparras', 'chaleco reflectivo', 'ropa de trabajo', 'protector auditivo', 'casco'];
const nuevo = () => ({ tipo: 'epp', fecha: isoDate(), persona: '', documento: '', elementos: [], tema: '', horas: '', dictadaPor: '' });

/**
 * Seguridad e higiene: entregas de elementos de protección y capacitaciones.
 * La Ordenanza 9233 de Paraná (art. 21) lo exige para quien trabaja con residuos.
 */
export default function Seguridad() {
  const resumen = useLoad('/seguridad/resumen');
  const registros = useLoad('/seguridad?limit=200');
  const [form, setForm] = useState(nuevo());
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const toggle = (el) => setForm({ ...form, elementos: form.elementos.includes(el) ? form.elementos.filter((x) => x !== el) : [...form.elementos, el] });
  const reload = () => Promise.all([resumen.reload(), registros.reload()]);

  async function guardar(e) {
    e.preventDefault();
    setErr(null);
    const body = {
      tipo: form.tipo,
      fecha: form.fecha,
      persona: form.persona.trim(),
      ...(form.documento.trim() && { documento: form.documento.trim() }),
      ...(form.tipo === 'epp'
        ? { elementos: form.elementos }
        : { tema: form.tema.trim(), ...(Number(form.horas) > 0 && { horas: Number(form.horas) }), ...(form.dictadaPor.trim() && { dictadaPor: form.dictadaPor.trim() }) }),
    };
    if (body.persona.length < 2) return setErr('Indicá a quién.');
    if (form.tipo === 'epp' && !form.elementos.length) return setErr('Marcá qué elementos se entregaron.');
    if (form.tipo === 'capacitacion' && !body.tema) return setErr('Indicá el tema de la capacitación.');
    try {
      await api('/seguridad', { method: 'POST', body });
      setForm({ ...nuevo(), tipo: form.tipo, fecha: form.fecha });
      await reload();
    } catch (e2) {
      setErr(e2.message);
    }
  }

  const r = resumen.data;
  return (
    <>
      <div className="view-head">
        <div>
          <h2>Seguridad e higiene</h2>
          <p className="muted">
            Entregas de elementos de protección y capacitaciones del personal (Ordenanza 9233 de Paraná, art. 21). Sirve de constancia ante una inspección.
          </p>
        </div>
      </div>
      <ErrorMsg error={resumen.error || registros.error} />
      {r?.pendientes > 0 && (
        <div className="strip alert-strip">
          {r.pendientes === 1 ? 'Una persona tiene' : `${r.pendientes} personas tienen`} la entrega de EPP (más de {r.vigenciaDias.epp} días) o la capacitación (más de {r.vigenciaDias.capacitacion} días) vencida o sin registrar.
        </div>
      )}

      <div className="grid2">
        <section className="card flush">
          <div className="card-head"><h3>Estado por persona</h3></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Persona</th><th>Última entrega de EPP</th><th>Última capacitación</th></tr></thead>
              <tbody>
                {r?.items.map((p) => (
                  <tr key={p.persona}>
                    <td>{p.persona}</td>
                    <td>
                      {p.epp ? <>{fmtFecha(p.epp.fecha)}<div className="muted small">{p.epp.detalle}</div></> : <span className="muted">Sin registro</span>}
                      {p.eppVencido && <div><Tag tone="red">Renovar</Tag></div>}
                    </td>
                    <td>
                      {p.capacitacion ? <>{fmtFecha(p.capacitacion.fecha)}<div className="muted small">{p.capacitacion.detalle}</div></> : <span className="muted">Sin registro</span>}
                      {p.capacitacionVencida && <div><Tag tone="red">Pendiente</Tag></div>}
                    </td>
                  </tr>
                ))}
                {r && !r.items.length && <tr><td colSpan={3} className="muted">Todavía no hay registros.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <form className="card stack" onSubmit={guardar}>
          <h3>Registrar</h3>
          <div className="row">
            <button type="button" className={form.tipo === 'epp' ? '' : 'secondary'} onClick={() => setForm({ ...form, tipo: 'epp' })}>Entrega de EPP</button>
            <button type="button" className={form.tipo === 'capacitacion' ? '' : 'secondary'} onClick={() => setForm({ ...form, tipo: 'capacitacion' })}>Capacitación</button>
          </div>
          <div className="form-grid">
            <label>Fecha<input type="date" value={form.fecha} onChange={set('fecha')} /></label>
            <label>Persona<input value={form.persona} onChange={set('persona')} placeholder="Nombre y apellido" list="personas-seguridad" /></label>
            <label>DNI (opcional)<input value={form.documento} onChange={set('documento')} /></label>
          </div>
          <datalist id="personas-seguridad">{r?.items.map((p) => <option key={p.persona} value={p.persona} />)}</datalist>
          {form.tipo === 'epp' ? (
            <div className="tags" role="group" aria-label="Elementos entregados">
              {ELEMENTOS.map((el) => (
                <label key={el} className="check">
                  <input type="checkbox" checked={form.elementos.includes(el)} onChange={() => toggle(el)} />
                  {el}
                </label>
              ))}
            </div>
          ) : (
            <div className="form-grid">
              <label>Tema<input value={form.tema} onChange={set('tema')} placeholder="Manejo seguro de la enfardadora" /></label>
              <label>Horas<input type="number" min="0" step="any" value={form.horas} onChange={set('horas')} /></label>
              <label>Dictada por<input value={form.dictadaPor} onChange={set('dictadaPor')} /></label>
            </div>
          )}
          <ErrorMsg error={err} />
          <div><button type="submit">Guardar</button></div>
        </form>
      </div>

      <section className="card flush">
        <div className="card-head"><h3>Historial</h3></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Fecha</th><th>Persona</th><th>Tipo</th><th>Detalle</th><th /></tr></thead>
            <tbody>
              {registros.data?.items.map((x) => (
                <tr key={x._id}>
                  <td className="num">{fmtFecha(x.fecha)}</td>
                  <td>{x.persona}</td>
                  <td>{x.tipo === 'epp' ? 'Entrega de EPP' : 'Capacitación'}</td>
                  <td>{x.tipo === 'epp' ? x.elementos.join(', ') : `${x.tema}${x.horas ? ` · ${x.horas} h` : ''}`}</td>
                  <td><ConfirmButton onConfirm={() => api(`/seguridad/${x._id}`, { method: 'DELETE' }).then(reload)} confirmLabel="Sí, borrar">Borrar</ConfirmButton></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
