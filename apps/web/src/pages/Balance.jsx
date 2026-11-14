import { useState } from 'react';
import { api, fmtPeso, fmtFecha, isoDate, descargar } from '../api.js';
import { useLoad, ErrorMsg, ConfirmButton } from '../ui.jsx';

const CATEGORIAS = {
  combustible: 'Combustible',
  reparaciones: 'Reparaciones y mantenimiento',
  repuestos: 'Repuestos e insumos',
  indumentaria: 'Indumentaria y seguridad',
  servicios: 'Servicios (luz, agua, internet)',
  retiros_socios: 'Retiros de socios',
  impuestos: 'Impuestos y tasas',
  otros: 'Otros',
};
const mesActual = () => isoDate().slice(0, 7);
const rangoMes = (mes) => {
  const [y, m] = mes.split('-').map(Number);
  return { desde: `${mes}-01`, hasta: isoDate(new Date(y, m, 0)) };
};

/** Balance mensual simple: lo que entró (ventas cobradas y cobros) menos lo que salió (gastos). */
export default function Balance() {
  const [mes, setMes] = useState(mesActual());
  const { desde, hasta } = rangoMes(mes);
  const balance = useLoad(`/balance?desde=${desde}&hasta=${hasta}`);
  const gastos = useLoad(`/gastos?limit=200`);
  const [form, setForm] = useState({ fecha: isoDate(), categoria: 'combustible', descripcion: '', monto: '', proveedor: '' });
  const [err, setErr] = useState(null);
  const b = balance.data;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const gastosMes = (gastos.data?.items ?? []).filter((g) => isoDate(g.fecha).startsWith(mes));

  async function guardar(e) {
    e.preventDefault();
    setErr(null);
    if (!(Number(form.monto) > 0)) return setErr('El monto tiene que ser mayor a cero.');
    try {
      await api('/gastos', { method: 'POST', body: { ...form, monto: Number(form.monto), proveedor: form.proveedor || undefined } });
      setForm({ ...form, descripcion: '', monto: '', proveedor: '' });
      await Promise.all([balance.reload(), gastos.reload()]);
    } catch (e2) {
      setErr(e2.message);
    }
  }

  const maxCat = Math.max(1, ...(b?.egresos.porCategoria ?? []).map((c) => c.monto));
  return (
    <>
      <div className="view-head">
        <div>
          <h2>Balance</h2>
          <p className="muted">Lo que entró y salió en el mes. No reemplaza la contabilidad: exportalo para el contador.</p>
        </div>
        <div className="row">
          <input type="month" aria-label="Mes" value={mes} onChange={(e) => setMes(e.target.value || mesActual())} style={{ width: 'auto' }} />
          <button type="button" className="secondary" onClick={() => descargar(`/balance/csv?desde=${desde}&hasta=${hasta}`, `balance-${mes}.csv`).catch((e) => setErr(e.message))}>
            Descargar para Excel
          </button>
        </div>
      </div>
      <ErrorMsg error={balance.error || err} />
      {b && (
        <div className="kpis">
          <div className="kpi green"><span>Ingresos</span><strong>{fmtPeso(b.ingresos.total)}</strong><span className="small">Ventas {fmtPeso(b.ingresos.ventasMaterial)} · Cobros {fmtPeso(b.ingresos.cobrosServicio)}</span></div>
          <div className="kpi"><span>Gastos</span><strong>{fmtPeso(b.egresos.total)}</strong></div>
          <div className={`kpi ${b.resultado < 0 ? 'alert' : 'green'}`}><span>Resultado del mes</span><strong>{fmtPeso(b.resultado)}</strong></div>
          <div className="kpi"><span>Pendiente de cobro</span><strong>{fmtPeso(b.pendiente.ventasSinCobrar + b.pendiente.liquidacionesImpagas)}</strong><span className="small">Ventas {fmtPeso(b.pendiente.ventasSinCobrar)} · Servicio {fmtPeso(b.pendiente.liquidacionesImpagas)}</span></div>
        </div>
      )}
      <div className="grid2">
        <section className="card flush">
          <div className="card-head"><h3>Gastos de {new Date(`${mes}-15`).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</h3></div>
          {b?.egresos.porCategoria.length > 0 && (
            <div className="bars" style={{ padding: '12px 16px' }}>
              {b.egresos.porCategoria.map((c) => (
                <div className="bar-row" key={c.categoria}>
                  <span className="bar-label">{c.nombre}</span>
                  <span className="bar-track"><span className="bar-fill" style={{ width: `${(c.monto / maxCat) * 100}%`, background: '#c62828' }} /></span>
                  <span className="bar-value">{fmtPeso(c.monto)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="table-wrap">
            <table>
              <thead><tr><th>Fecha</th><th>Concepto</th><th>Categoría</th><th className="r">Monto</th><th /></tr></thead>
              <tbody>
                {gastosMes.map((g) => (
                  <tr key={g._id}>
                    <td className="num">{fmtFecha(g.fecha)}</td>
                    <td>{g.descripcion}{g.proveedor && <div className="muted small">{g.proveedor}</div>}</td>
                    <td className="small">{CATEGORIAS[g.categoria]}</td>
                    <td className="r num">{fmtPeso(g.monto)}</td>
                    <td><ConfirmButton onConfirm={() => api(`/gastos/${g._id}`, { method: 'DELETE' }).then(() => Promise.all([balance.reload(), gastos.reload()]))} confirmLabel="Sí, borrar">Borrar</ConfirmButton></td>
                  </tr>
                ))}
                {!gastosMes.length && <tr><td colSpan={5} className="muted">No hay gastos cargados en el mes.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        <form className="card stack" onSubmit={guardar}>
          <h3>Cargar un gasto</h3>
          <label>Fecha<input type="date" value={form.fecha} onChange={set('fecha')} /></label>
          <label>
            Categoría
            <select value={form.categoria} onChange={set('categoria')}>
              {Object.entries(CATEGORIAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label>Descripción<input value={form.descripcion} onChange={set('descripcion')} placeholder="Gasoil camión" required minLength={2} /></label>
          <label>Monto ($)<input type="number" min="0" step="any" value={form.monto} onChange={set('monto')} required /></label>
          <label>Proveedor (opcional)<input value={form.proveedor} onChange={set('proveedor')} /></label>
          <button type="submit">Guardar gasto</button>
        </form>
      </div>
    </>
  );
}
