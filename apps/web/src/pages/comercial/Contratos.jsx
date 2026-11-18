// Contratos de venta: kg pactados con un comprador, con su avance calculado de las ventas.
import { useState } from 'react';
import { api, fmtFecha, fmtKg, fmtPeso, getUser, isoDate } from '../../api.js';
import { useLoad, ErrorMsg, ConfirmButton } from '../../ui.jsx';
import Ayuda from '../../shell/Ayuda.jsx';

const TONO = { cumplido: 'green', en_curso: 'green', atrasado: 'sun', vencido: 'red', no_empezo: 'gray' };

export default function Contratos() {
  const { data, error, reload } = useLoad('/contratos');
  const clientes = useLoad('/clientes?limit=200');
  const mats = useLoad('/materiales?limit=200');
  const [f, setF] = useState({ comprador: '', material: '', kg: '', precioKg: '', desde: isoDate(), hasta: '' });
  const [err, setErr] = useState(null);
  const admin = ['admin', 'administracion'].includes(getUser()?.rol);
  const compradores = (clientes.data?.items ?? []).filter((c) => ['comprador', 'ambos'].includes(c.tipo));

  async function agregar(e) {
    e.preventDefault();
    setErr(null);
    try {
      await api('/contratos', { method: 'POST', body: { ...f, kg: Number(f.kg), precioKg: Number(f.precioKg) } });
      setF({ ...f, kg: '', precioKg: '', hasta: '' });
      reload();
    } catch (x) {
      setErr(x.message);
    }
  }

  return (
    <div className="stack">
      <div className="page-h">
        <div>
          <h2>Contratos de venta<Ayuda>El avance sale solo de las ventas registradas a ese comprador, de ese material y dentro de las fechas del contrato.</Ayuda></h2>
          <p className="muted">Kg pactados, plazo y precio; avisa si al ritmo actual no se llega.</p>
        </div>
      </div>
      <ErrorMsg error={error} />
      {data?.items.map((c) => {
        const a = c.avance;
        return (
          <section key={c._id} className="card stack">
            <div className="page-h">
              <div>
                <h3>{c.comprador?.razonSocial} · {c.material?.nombre}</h3>
                <p className="small muted">{fmtFecha(c.desde)} al {fmtFecha(c.hasta)} · {fmtKg(c.kg)} a {fmtPeso(c.precioKg)} por kg</p>
              </div>
              <span className={`tag ${TONO[a.estado]}`}>{data.estados[a.estado]}</span>
            </div>
            <div className="barra-prog" aria-hidden="true"><i style={{ width: `${a.pct}%` }} /></div>
            <div className="row small">
              <span><b>{fmtKg(a.entregado)}</b> entregados ({a.pct.toLocaleString('es-AR')} %)</span>
              <span>· <b>{fmtKg(a.pendiente)}</b> pendientes</span>
              <span>· <b>{a.restantes}</b> días restantes</span>
              {a.necesarioDiario != null && <span>· hace falta <b>{fmtKg(a.necesarioDiario)}</b> por día (vas a {fmtKg(a.ritmoDiario)})</span>}
              {a.precioProm != null && <span>· precio cobrado <b>{fmtPeso(a.precioProm)}</b></span>}
            </div>
            {a.ventasBajoPrecio > 0 && <p className="small error">{a.ventasBajoPrecio === 1 ? 'Una venta quedó' : `${a.ventasBajoPrecio} ventas quedaron`} por debajo del precio pactado.</p>}
            {admin && <div><ConfirmButton onConfirm={() => api(`/contratos/${c._id}`, { method: 'DELETE' }).then(reload)}>Dar de baja</ConfirmButton></div>}
          </section>
        );
      })}
      {data && !data.items.length && <p className="muted">Todavía no hay contratos.</p>}
      {admin && (
        <form className="card stack" onSubmit={agregar}>
          <h3>Nuevo contrato</h3>
          <div className="form-grid">
            <label>
              Comprador
              <select required value={f.comprador} onChange={(e) => setF({ ...f, comprador: e.target.value })}>
                <option value="">Elegí…</option>
                {compradores.map((c) => <option key={c._id} value={c._id}>{c.razonSocial}</option>)}
              </select>
            </label>
            <label>
              Material
              <select required value={f.material} onChange={(e) => setF({ ...f, material: e.target.value })}>
                <option value="">Elegí…</option>
                {(mats.data?.items ?? []).filter((m) => !m.mezcla).map((m) => <option key={m._id} value={m._id}>{m.nombre}</option>)}
              </select>
            </label>
            <label>Kg pactados<input type="number" min="1" step="any" required value={f.kg} onChange={(e) => setF({ ...f, kg: e.target.value })} /></label>
            <label>Precio por kg ($)<input type="number" min="0" step="any" required value={f.precioKg} onChange={(e) => setF({ ...f, precioKg: e.target.value })} /></label>
            <label>Desde<input type="date" required value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} /></label>
            <label>Hasta<input type="date" required value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} /></label>
          </div>
          {err && <p className="error" role="alert">{err}</p>}
          <div className="row"><button type="submit">Agregar contrato</button></div>
        </form>
      )}
    </div>
  );
}
