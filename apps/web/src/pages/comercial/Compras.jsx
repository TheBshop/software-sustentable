// Compras de material a proveedores del padrón (cooperativas, acopiadores, industrias).
// Las compras a recuperadores urbanos se cargan en Operación › Recuperadores.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtFecha, fmtKg, fmtPeso, getUser, isoDate, openPdf } from '../../api.js';
import { useLoad, ErrorMsg, ItemsEditor, itemsToApi } from '../../ui.jsx';
import Ayuda from '../../shell/Ayuda.jsx';

export default function Compras() {
  const compras = useLoad('/compras');
  const clientes = useLoad('/clientes?limit=200');
  const mats = useLoad('/materiales?limit=200');
  const [f, setF] = useState({ proveedor: '', fecha: isoDate(), pagada: false, items: [{ material: '', pesoKg: '', unidad: 'kg', precioKg: '' }] });
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(null);
  const puede = ['admin', 'administracion', 'operador_planta'].includes(getUser()?.rol);
  const proveedores = (clientes.data?.items ?? []).filter((c) => ['proveedor', 'ambos'].includes(c.tipo));
  const materiales = (mats.data?.items ?? []).filter((m) => !m.mezcla);

  async function guardar(e) {
    e.preventDefault();
    setError(null);
    setOk(null);
    try {
      const items = itemsToApi(f.items, true);
      const c = await api('/compras', { method: 'POST', body: { proveedor: f.proveedor, fecha: f.fecha, pagada: f.pagada, items } });
      setOk(`Compra N° ${String(c.numero).padStart(6, '0')} registrada: entró al stock y abrió su lote.`);
      setF({ ...f, items: [{ material: '', pesoKg: '', unidad: 'kg', precioKg: '' }] });
      compras.reload();
    } catch (x) {
      setError(x.message);
    }
  }
  const pagar = (id) => api(`/compras/${id}`, { method: 'PATCH', body: { pagada: true } }).then(compras.reload).catch((x) => setError(x.message));

  return (
    <div className="stack">
      <div className="page-h">
        <div>
          <h2>Compras<Ayuda>Cada compra entra al stock, abre un lote por material y suma al costo promedio de compra (Stock y margen). Las pagadas van al balance en la fecha de pago.</Ayuda></h2>
          <p className="muted">A cooperativas, acopiadores e industrias. Las compras a recuperadores se cargan en <Link to="/operacion/recuperadores">Recuperadores</Link>.</p>
        </div>
      </div>
      {puede && (
        <form className="card stack" onSubmit={guardar}>
          <h3>Nueva compra</h3>
          <div className="form-grid">
            <label>
              Proveedor
              <select required value={f.proveedor} onChange={(e) => setF({ ...f, proveedor: e.target.value })}>
                <option value="">Elegí…</option>
                {proveedores.map((p) => <option key={p._id} value={p._id}>{p.razonSocial}</option>)}
              </select>
            </label>
            <label>Fecha<input type="date" required value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></label>
            <label className="check" style={{ alignSelf: 'end' }}><input type="checkbox" checked={f.pagada} onChange={(e) => setF({ ...f, pagada: e.target.checked })} /> Ya está pagada</label>
          </div>
          {!proveedores.length && clientes.data && <p className="small muted">Primero cargá el proveedor en <Link to="/comercial/clientes">Clientes y proveedores</Link> con tipo "Proveedor".</p>}
          <ItemsEditor materiales={materiales} items={f.items} onChange={(items) => setF({ ...f, items })} conPrecio />
          {error && <p className="error" role="alert">{error}</p>}
          {ok && <p className="ok" role="status">{ok}</p>}
          <div className="row"><button type="submit">Registrar compra</button></div>
        </form>
      )}
      <ErrorMsg error={compras.error} />
      <div className="card flush table-wrap">
        <table>
          <thead><tr><th>N°</th><th>Fecha</th><th>Vendió</th><th>Materiales</th><th className="r">Kg</th><th className="r">Total</th><th>Pago</th><th /></tr></thead>
          <tbody>
            {compras.data?.items.map((c) => (
              <tr key={c._id}>
                <td className="mono">{String(c.numero).padStart(6, '0')}</td>
                <td>{fmtFecha(c.fecha)}</td>
                <td>{c.proveedor?.razonSocial ?? c.recuperador?.nombre}<div className="small muted">{c.proveedor ? 'Proveedor' : 'Recuperador'}</div></td>
                <td>{c.items.map((i) => i.material?.nombre).join(', ')}</td>
                <td className="r num">{fmtKg(c.items.reduce((a, i) => a + i.pesoKg, 0))}</td>
                <td className="r num">{fmtPeso(c.total)}</td>
                <td>{c.pagada ? <span className="tag green">Pagada</span> : <span className="tag sun">A pagar</span>}</td>
                <td className="actions">
                  {!c.pagada && ['admin', 'administracion'].includes(getUser()?.rol) && <button type="button" className="link" onClick={() => pagar(c._id)}>Marcar pagada</button>}
                  <button type="button" className="link" onClick={() => openPdf(`/compras/${c._id}/recibo.pdf`)}>Recibo</button>
                </td>
              </tr>
            ))}
            {compras.data && !compras.data.items.length && <tr><td colSpan={8} className="muted">Todavía no hay compras.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
