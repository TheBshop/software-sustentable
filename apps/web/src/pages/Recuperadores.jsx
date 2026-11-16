import { useState } from 'react';
import { api, openPdf, fmtFecha, fmtKg, fmtPeso, isoDate, getUser, pad } from '../api.js';
import { useLoad, ErrorMsg, Tag, ItemsEditor, itemsToApi } from '../ui.jsx';

const VEHICULOS = { a_pie: 'A pie', carro: 'Carro', bicicleta: 'Bicicleta', moto: 'Moto', vehiculo: 'Vehículo' };
const MEDIOS = { efectivo: 'Efectivo', transferencia: 'Transferencia', billetera: 'Billetera virtual', otro: 'Otro' };

/** Recuperadores urbanos que le venden a la cooperativa y las compras de material. */
export default function Recuperadores() {
  const mes = isoDate().slice(0, 7);
  const lista = useLoad('/recuperadores?limit=200');
  const resumen = useLoad(`/recuperadores/resumen?mes=${mes}`);
  const compras = useLoad('/compras');
  const materiales = useLoad('/materiales?limit=200');
  const [err, setErr] = useState(null);
  const puedePagar = ['admin', 'administracion'].includes(getUser()?.rol);
  const recargar = () => Promise.all([lista.reload(), resumen.reload(), compras.reload()]);
  const t = resumen.data?.totales;

  async function pagar(c, medioPago) {
    setErr(null);
    try {
      await api(`/compras/${c._id}`, { method: 'PATCH', body: { pagada: true, medioPago } });
      await recargar();
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <>
      <div className="view-head">
        <div>
          <h2>Recuperadores</h2>
          <p className="muted">Quiénes le venden material a la cooperativa y cada compra, con su recibo. Lo comprado entra al stock de la planta.</p>
        </div>
      </div>
      <ErrorMsg error={err || lista.error || compras.error} />

      {t && (
        <div className="kpis">
          <div className="kpi"><span>Recuperadores que vendieron este mes</span><strong>{t.recuperadores}</strong></div>
          <div className="kpi"><span>Material comprado</span><strong>{fmtKg(t.kg)}</strong></div>
          <div className="kpi"><span>Monto</span><strong>{fmtPeso(t.monto)}</strong></div>
          <div className={`kpi ${t.pendiente > 0 ? 'alert' : ''}`}><span>Falta pagar</span><strong>{fmtPeso(t.pendiente)}</strong></div>
        </div>
      )}

      <div className="grid2">
        <section className="card stack">
          <h3>Registrar una compra</h3>
          <NuevaCompra recuperadores={(lista.data?.items ?? []).filter((r) => r.activo !== false)} materiales={(materiales.data?.items ?? []).filter((m) => !m.mezcla && m.fraccion !== 'basura')} onSaved={recargar} />
        </section>
        <section className="card stack">
          <h3>Registro de recuperadores</h3>
          <NuevoRecuperador onSaved={recargar} />
          <ul className="lista-simple">
            {lista.data?.items.map((r) => (
              <li key={r._id}>
                <span>
                  <b>{r.nombre}</b>{r.asociado && <> <Tag tone="green">Socio/a</Tag></>}
                  <span className="muted small"> · {VEHICULOS[r.vehiculo] ?? ''}{r.zona && ` · ${r.zona}`}</span>
                </span>
              </li>
            ))}
            {lista.data && !lista.data.items.length && <li className="muted small">Todavía no hay recuperadores registrados.</li>}
          </ul>
        </section>
      </div>

      {resumen.data?.items.length > 0 && (
        <section className="card flush">
          <div className="card-head"><h3>Este mes, por recuperador</h3></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Recuperador</th><th className="r">Compras</th><th className="r">Kilos</th><th className="r">Precio promedio</th><th className="r">Monto</th><th className="r">Falta pagar</th></tr></thead>
              <tbody>
                {resumen.data.items.map((r) => (
                  <tr key={r.recuperador}><td>{r.recuperador}</td><td className="r num">{r.compras}</td><td className="r num">{fmtKg(r.kg)}</td><td className="r num">{r.precioPromedioKg == null ? '—' : `${fmtPeso(r.precioPromedioKg)}/kg`}</td><td className="r num">{fmtPeso(r.monto)}</td><td className="r num">{r.pendiente ? fmtPeso(r.pendiente) : '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card flush">
        <div className="card-head"><h3>Compras</h3></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>N°</th><th>Fecha</th><th>Recuperador</th><th>Material</th><th className="r">Total</th><th>Pago</th><th /></tr></thead>
            <tbody>
              {compras.data?.items.map((c) => (
                <tr key={c._id}>
                  <td className="mono">{pad(c.numero)}</td>
                  <td className="num">{fmtFecha(c.fecha)}</td>
                  <td>{c.recuperador?.nombre}</td>
                  <td className="small">{c.items.map((i) => `${i.material?.nombre} ${fmtKg(i.pesoKg)} × ${fmtPeso(i.precioKg)}`).join(' · ')}</td>
                  <td className="r num">{fmtPeso(c.total)}</td>
                  <td>
                    {c.pagada ? <Tag tone="green">Pagada{c.medioPago ? ` · ${MEDIOS[c.medioPago]}` : ''}</Tag> : puedePagar ? (
                      <select aria-label="Marcar pagada" value="" onChange={(e) => e.target.value && pagar(c, e.target.value)} style={{ width: 'auto' }}>
                        <option value="">Marcar pagada…</option>
                        {Object.entries(MEDIOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    ) : <Tag tone="sun">Sin pagar</Tag>}
                  </td>
                  <td><button type="button" className="link" onClick={() => openPdf(`/compras/${c._id}/recibo.pdf`).catch((e) => setErr(e.message))}>Recibo</button></td>
                </tr>
              ))}
              {compras.data && !compras.data.items.length && <tr><td colSpan={7} className="muted">Todavía no hay compras.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function NuevaCompra({ recuperadores, materiales, onSaved }) {
  const vacio = () => ({ recuperador: '', fecha: isoDate(), pagada: false, items: [{ material: '', pesoKg: '', precioKg: '' }] });
  const [form, setForm] = useState(vacio);
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(null);
  async function guardar(e) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    try {
      if (!form.recuperador) throw new Error('Elegí quién vende el material.');
      const c = await api('/compras', { method: 'POST', body: { recuperador: form.recuperador, fecha: form.fecha, pagada: form.pagada, ...(form.pagada && { medioPago: 'efectivo' }), items: itemsToApi(form.items, true) } });
      setOk(`Compra N° ${pad(c.numero)} registrada por ${fmtPeso(c.total)}.`);
      setForm(vacio());
      await onSaved();
    } catch (e2) {
      setErr(e2.message);
    }
  }
  return (
    <form className="stack" onSubmit={guardar}>
      <div className="form-grid">
        <label>Recuperador<select value={form.recuperador} onChange={(e) => setForm({ ...form, recuperador: e.target.value })}><option value="">Elegí…</option>{recuperadores.map((r) => <option key={r._id} value={r._id}>{r.nombre}</option>)}</select></label>
        <label>Fecha<input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></label>
      </div>
      <ItemsEditor conPrecio conUnidades materiales={materiales} items={form.items} onChange={(items) => setForm({ ...form, items })} />
      <label className="check"><input type="checkbox" checked={form.pagada} onChange={(e) => setForm({ ...form, pagada: e.target.checked })} /> Se pagó en el momento (efectivo)</label>
      <ErrorMsg error={err} />
      {ok && <p className="ok">{ok}</p>}
      <div><button type="submit">Registrar compra</button></div>
    </form>
  );
}

function NuevoRecuperador({ onSaved }) {
  const vacio = { nombre: '', zona: '', vehiculo: 'carro', asociado: false };
  const [form, setForm] = useState(vacio);
  const [err, setErr] = useState(null);
  async function guardar(e) {
    e.preventDefault();
    setErr(null);
    if (form.nombre.trim().length < 2) return setErr('Indicá el nombre.');
    try {
      await api('/recuperadores', { method: 'POST', body: { nombre: form.nombre.trim(), vehiculo: form.vehiculo, asociado: form.asociado, ...(form.zona.trim() && { zona: form.zona.trim() }) } });
      setForm(vacio);
      await onSaved();
    } catch (e2) {
      setErr(e2.message);
    }
  }
  return (
    <form className="stack" onSubmit={guardar}>
      <div className="form-grid">
        <label>Nombre<input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></label>
        <label>Barrio o recorrido<input value={form.zona} onChange={(e) => setForm({ ...form, zona: e.target.value })} /></label>
        <label>Cómo trabaja<select value={form.vehiculo} onChange={(e) => setForm({ ...form, vehiculo: e.target.value })}>{Object.entries(VEHICULOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      </div>
      <label className="check"><input type="checkbox" checked={form.asociado} onChange={(e) => setForm({ ...form, asociado: e.target.checked })} /> Es socio/a de la cooperativa</label>
      <ErrorMsg error={err} />
      <div><button type="submit" className="secondary">Agregar recuperador</button></div>
    </form>
  );
}
