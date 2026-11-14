import { useState } from 'react';
import { api, fmtKg, fmtFecha } from '../api.js';
import { useLoad, ErrorMsg, Tag } from '../ui.jsx';
import { FraccionChip } from '../residuos.jsx';
import { CalidadSeparacion, FormClasificacion, CAUSAS } from './CalidadSeparacion.jsx';

const TIPOS = { ingreso: ['Ingreso', 'info'], venta: ['Venta (valorización)', 'green'], rechazo: ['Rechazo (disp. final)', 'red'], ajuste: ['Ajuste', 'gray'] };

/**
 * Stock de planta calculado del libro de movimientos, con el registro de rechazos
 * (material no valorizable que va a disposición final).
 */
export default function StockPlanta({ materiales, refreshKey }) {
  const [k, setK] = useState(0);
  const stock = useLoad(`/planta/stock?k=${refreshKey}-${k}`);
  const clientes = useLoad('/clientes?tipo=generador&limit=200');
  const [clasificando, setClasificando] = useState(false);
  const movs = useLoad(`/planta/movimientos?k=${refreshKey}-${k}`);
  const [form, setForm] = useState(null);
  const [verMovs, setVerMovs] = useState(false);
  const [err, setErr] = useState(null);

  async function rechazar(e) {
    e.preventDefault();
    setErr(null);
    if (!form.material) return setErr('Elegí el material.');
    if (!(Number(form.kg) > 0)) return setErr('Los kilos tienen que ser mayores a cero.');
    try {
      await api('/planta/rechazos', {
        method: 'POST',
        body: { material: form.material, kg: Number(form.kg), causa: form.causa, ...(form.cliente && { cliente: form.cliente }), ...(form.motivo.trim() && { motivo: form.motivo.trim() }) },
      });
      setK((x) => x + 1);
      setForm(null);
      await Promise.all([stock.reload(), movs.reload()]);
    } catch (e2) {
      setErr(e2.message);
    }
  }

  return (
    <section className="card stack">
      <div className="view-head">
        <div>
          <h3>Stock en planta</h3>
          <p className="muted small">Se calcula de los movimientos: ingresos − ventas − rechazos ± ajustes.</p>
        </div>
        <div className="row">
          <button type="button" className="secondary sm" onClick={() => setVerMovs(!verMovs)}>{verMovs ? 'Ocultar movimientos' : 'Ver movimientos'}</button>
          {!clasificando && <button type="button" className="secondary sm" onClick={() => setClasificando(true)}>Clasificar lo recibido</button>}
          {!form && <button type="button" className="secondary sm" onClick={() => setForm({ material: '', kg: '', motivo: '', causa: 'humedad', cliente: '' })}>Registrar rechazo</button>}
        </div>
      </div>

      {form && (
        <form className="edit-grid" onSubmit={rechazar}>
          <label>
            Material
            <select value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })}>
              <option value="">Elegí…</option>
              {materiales.map((m) => <option key={m._id} value={m._id}>{m.nombre}</option>)}
            </select>
          </label>
          <label>Kilos<input type="number" min="0" step="any" value={form.kg} onChange={(e) => setForm({ ...form, kg: e.target.value })} /></label>
          <label>
            Causa
            <select value={form.causa} onChange={(e) => setForm({ ...form, causa: e.target.value })}>
              {Object.entries(CAUSAS).filter(([c]) => c !== 'sin_dato').map(([c, v]) => <option key={c} value={c}>{v}</option>)}
            </select>
          </label>
          <label style={{ width: 230 }}>
            ¿De qué generador vino? (opcional)
            <select value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })}>
              <option value="">No se sabe / varios</option>
              {clientes.data?.items.map((c) => <option key={c._id} value={c._id}>{c.razonSocial}</option>)}
            </select>
          </label>
          <label style={{ width: 220 }}>Detalle<input value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} placeholder="Cartón mojado por la lluvia…" /></label>
          <div className="row"><button type="submit">Enviar a disposición final</button><button type="button" className="secondary" onClick={() => setForm(null)}>Cancelar</button></div>
        </form>
      )}
      {clasificando && (
        <div className="edit-row" style={{ padding: 14, borderRadius: 8 }}>
          <FormClasificacion materiales={materiales} onCancel={() => setClasificando(false)} onDone={() => { setClasificando(false); setK((x) => x + 1); }} />
        </div>
      )}
      <ErrorMsg error={err || stock.error} />

      <div className="table-wrap">
        <table>
          <thead><tr><th>Material</th><th>Fracción</th><th className="r">Stock</th></tr></thead>
          <tbody>
            {stock.data?.items.map((s) => (
              <tr key={s.materialId}>
                <td>{s.material}</td>
                <td><FraccionChip fraccion={s.fraccion} corriente={s.corriente} /></td>
                <td className="r num">{s.kg < 0 ? <Tag tone="red">{fmtKg(s.kg)} · revisar</Tag> : fmtKg(s.kg)}</td>
              </tr>
            ))}
            {!stock.data?.items.length && <tr><td colSpan={3} className="muted">Todavía no hay movimientos.</td></tr>}
          </tbody>
        </table>
      </div>

      {verMovs && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Fecha</th><th>Movimiento</th><th>Material</th><th className="r">Kilos</th><th>Detalle</th></tr></thead>
            <tbody>
              {movs.data?.items.map((m) => (
                <tr key={m._id}>
                  <td className="num">{fmtFecha(m.fecha)}</td>
                  <td><Tag tone={TIPOS[m.tipo][1]}>{TIPOS[m.tipo][0]}</Tag></td>
                  <td>{m.material?.nombre}</td>
                  <td className="r num">{m.kg > 0 ? '+' : ''}{fmtKg(m.kg)}</td>
                  <td className="small muted">{m.motivo ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">Los movimientos no se editan ni se borran: las correcciones quedan como ajustes (trazabilidad, Decreto 779/2022).</p>
        </div>
      )}
      <CalidadSeparacion refreshKey={`${refreshKey}-${k}`} />
    </section>
  );
}
