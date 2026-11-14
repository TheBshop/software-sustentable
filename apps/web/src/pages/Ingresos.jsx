import { useState } from 'react';
import { api, fmtKg, fmtFecha, isoDate } from '../api.js';
import { useLoad, ErrorMsg, ItemsEditor, itemsToApi, Tag } from '../ui.jsx';
import StockPlanta from './StockPlanta.jsx';

const ORIGENES = { retiro: 'Retiro propio', recuperador: 'Recuperador', entrega_voluntaria: 'Entrega voluntaria', otro: 'Otro' };
const nuevo = () => ({ fecha: isoDate(), origen: 'recuperador', detalleOrigen: '', items: [{ material: '', pesoKg: '' }], observaciones: '' });

/**
 * Ingresos a planta. Los de retiros propios se registran al pesar el retiro; acá se cargan
 * sobre todo los que llegan por otras vías (recuperadores, entregas voluntarias).
 */
export default function Ingresos() {
  const { data, error, reload } = useLoad('/ingresos?limit=100');
  const materiales = useLoad('/materiales?limit=200');
  const [form, setForm] = useState(null);
  const [err, setErr] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  async function save(e) {
    e.preventDefault();
    setErr(null);
    try {
      const body = {
        fecha: form.fecha,
        origen: form.origen,
        items: itemsToApi(form.items),
        ...(form.detalleOrigen.trim() && { detalleOrigen: form.detalleOrigen.trim() }),
        ...(form.observaciones.trim() && { observaciones: form.observaciones.trim() }),
      };
      await api('/ingresos', { method: 'POST', body });
      setForm(null);
      setRefreshKey((k) => k + 1);
      await reload();
    } catch (e2) {
      setErr(e2.message);
    }
  }

  const items = data?.items ?? [];
  const totalMes = items
    .filter((i) => new Date(i.fecha).getMonth() === new Date().getMonth() && new Date(i.fecha).getFullYear() === new Date().getFullYear())
    .reduce((a, i) => a + i.items.reduce((b, it) => b + it.pesoKg, 0), 0);

  return (
    <>
      <div className="view-head">
        <div>
          <h2>Planta y stock</h2>
          <p className="muted">Este mes ingresaron {fmtKg(totalMes)}.</p>
        </div>
        {!form && <button type="button" onClick={() => { setErr(null); setForm(nuevo()); }}>Registrar ingreso</button>}
      </div>

      {form && (
        <form className="card stack" onSubmit={save}>
          <h3>Nuevo ingreso</h3>
          <div className="form-grid">
            <label>Fecha<input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></label>
            <label>
              Origen
              <select value={form.origen} onChange={(e) => setForm({ ...form, origen: e.target.value })}>
                {/* Los ingresos de retiros propios se generan solos al pesar el retiro */}
                {Object.entries(ORIGENES).filter(([k]) => k !== 'retiro').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label>Detalle del origen<input value={form.detalleOrigen} onChange={(e) => setForm({ ...form, detalleOrigen: e.target.value })} placeholder="Nombre del recuperador, institución…" /></label>
          </div>
          <ItemsEditor materiales={materiales.data?.items ?? []} items={form.items} onChange={(items) => setForm({ ...form, items })} />
          <label>Observaciones<input value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} /></label>
          <ErrorMsg error={err} />
          <div className="row"><button type="submit">Guardar ingreso</button><button type="button" className="secondary" onClick={() => setForm(null)}>Cancelar</button></div>
        </form>
      )}

      <StockPlanta materiales={materiales.data?.items ?? []} refreshKey={refreshKey} />

      <h3>Ingresos</h3>
      <ErrorMsg error={error} />
      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Fecha</th><th>Origen</th><th>Materiales</th><th className="r">Total</th></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i._id}>
                  <td className="num">{fmtFecha(i.fecha)}</td>
                  <td>
                    <Tag tone={i.origen === 'retiro' ? 'info' : 'gray'}>{ORIGENES[i.origen]}</Tag>
                    {i.detalleOrigen && <div className="muted small">{i.detalleOrigen}</div>}
                  </td>
                  <td>{i.items.map((it) => `${it.material?.nombre} ${fmtKg(it.pesoKg)}`).join(' · ')}</td>
                  <td className="r num">{fmtKg(i.items.reduce((a, it) => a + it.pesoKg, 0))}</td>
                </tr>
              ))}
              {!items.length && <tr><td colSpan={4} className="muted">Todavía no hay ingresos registrados.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
