import { useState } from 'react';
import { api, fmtKg, fmtPeso, fmtFecha, isoDate } from '../api.js';
import { useLoad, ErrorMsg, ItemsEditor, itemsToApi, Tag } from '../ui.jsx';

const nueva = () => ({ fecha: isoDate(), comprador: '', remito: '', items: [{ material: '', pesoKg: '', precioKg: '' }] });

export default function Ventas() {
  const { data, error, reload } = useLoad('/ventas?limit=100');
  const materiales = useLoad('/materiales?limit=200');
  const clientes = useLoad('/clientes?limit=200');
  const [form, setForm] = useState(null);
  const [err, setErr] = useState(null);
  const [avisos, setAvisos] = useState([]);
  const resumen = useLoad('/ventas/resumen');
  const compradores = (clientes.data?.items ?? []).filter((c) => c.tipo !== 'generador');

  const totalForm = form
    ? form.items.reduce((a, it) => a + (Number(it.pesoKg) || 0) * (Number(it.precioKg) || 0), 0)
    : 0;

  async function save(e) {
    e.preventDefault();
    setErr(null);
    try {
      if (!form.comprador) throw new Error('Elegí el comprador.');
      const nueva = await api('/ventas', {
        method: 'POST',
        body: { fecha: form.fecha, comprador: form.comprador, items: itemsToApi(form.items, true), ...(form.remito.trim() && { remito: form.remito.trim() }) },
      });
      setForm(null);
      setAvisos(nueva.avisos ?? []);
      await Promise.all([reload(), resumen.reload()]);
    } catch (e2) {
      setErr(e2.message);
    }
  }

  const ventas = data?.items ?? [];
  const porCobrar = ventas.filter((v) => !v.cobrada).reduce((a, v) => a + v.total, 0);

  return (
    <>
      <div className="view-head">
        <div>
          <h2>Ventas de material</h2>
          <p className="muted">Por cobrar: {fmtPeso(porCobrar)}</p>
        </div>
        {!form && <button type="button" onClick={() => { setErr(null); setForm(nueva()); }}>Registrar venta</button>}
      </div>

      {form && (
        <form className="card stack" onSubmit={save}>
          <h3>Nueva venta</h3>
          <div className="form-grid">
            <label>Fecha<input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></label>
            <label>
              Comprador
              <select value={form.comprador} onChange={(e) => setForm({ ...form, comprador: e.target.value })}>
                <option value="">Elegí un comprador</option>
                {compradores.map((c) => <option key={c._id} value={c._id}>{c.razonSocial}</option>)}
              </select>
            </label>
            <label>Remito<input value={form.remito} onChange={(e) => setForm({ ...form, remito: e.target.value })} placeholder="R-0001" /></label>
          </div>
          {!compradores.length && clientes.data && <p className="muted small">No hay compradores cargados. Dalos de alta en Clientes con tipo "Comprador".</p>}
          <ItemsEditor conPrecio materiales={materiales.data?.items ?? []} items={form.items} onChange={(items) => setForm({ ...form, items })} />
          <div className="total-line"><span>Total</span><span className="num">{fmtPeso(totalForm)}</span></div>
          <ErrorMsg error={err} />
          <div className="row"><button type="submit">Guardar venta</button><button type="button" className="secondary" onClick={() => setForm(null)}>Cancelar</button></div>
        </form>
      )}

      {avisos.length > 0 && (
        <div className="strip alert-strip">
          <b>Venta registrada por debajo del precio de mercado.</b>{' '}
          {avisos.map((a) => `${a.mensaje}: se dejaron de ganar ${fmtPeso(a.diferenciaTotal)}.`).join(' ')}
        </div>
      )}
      <ErrorMsg error={error} />
      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Fecha</th><th>Comprador</th><th>Materiales</th><th className="r">Total</th><th>Cobro</th></tr></thead>
            <tbody>
              {ventas.map((v) => (
                <tr key={v._id}>
                  <td className="num">{fmtFecha(v.fecha)}{v.remito && <div className="muted small">{v.remito}</div>}</td>
                  <td>{v.comprador?.razonSocial}</td>
                  <td>
                    {v.items.map((it) => `${it.material?.nombre} ${fmtKg(it.pesoKg)} × ${fmtPeso(it.precioKg)}`).join(' · ')}
                    {v.items.some((it) => it.referenciaMinKg != null && it.precioKg < it.referenciaMinKg) && <div><Tag tone="red">Debajo del precio de mercado</Tag></div>}
                  </td>
                  <td className="r num">{fmtPeso(v.total)}</td>
                  <td>
                    {v.cobrada ? (
                      <Tag tone="green">Cobrada</Tag>
                    ) : (
                      <button type="button" className="secondary sm" onClick={() => api(`/ventas/${v._id}`, { method: 'PATCH', body: { cobrada: true } }).then(reload)}>
                        Marcar cobrada
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!ventas.length && <tr><td colSpan={5} className="muted">Todavía no hay ventas registradas.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <section className="card flush">
        <div className="card-head">
          <h3>Precio promedio por comprador</h3>
          <span className="muted small">Para saber a quién conviene venderle cada material</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Material</th><th>Comprador</th><th className="r">Kilos</th><th className="r">Promedio $/kg</th><th>Mercado $/kg</th><th>Ventas debajo</th></tr></thead>
            <tbody>
              {resumen.data?.items.map((r) => (
                <tr key={r.material + r.comprador}>
                  <td>{r.material}</td>
                  <td>{r.comprador}</td>
                  <td className="r num">{fmtKg(r.kg)}</td>
                  <td className="r num">{fmtPeso(r.precioPromedioKg)}</td>
                  <td className="small">{r.referencia?.minKg != null ? `${fmtPeso(r.referencia.minKg)} a ${fmtPeso(r.referencia.maxKg)}` : '—'}</td>
                  <td>{r.ventasDebajoDeReferencia ? <Tag tone="red">{r.ventasDebajoDeReferencia} de {r.ventas}</Tag> : <Tag tone="green">Ninguna</Tag>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
