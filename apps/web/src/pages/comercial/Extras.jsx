// Agregados a pantallas existentes: resumen del padrón (arriba de Clientes) e ingresos de caja (abajo del Balance).
import { useState } from 'react';
import { api, fmtFecha, fmtKg, fmtPeso, getUser, isoDate } from '../../api.js';
import { useLoad, ConfirmButton } from '../../ui.jsx';
import Ayuda from '../../shell/Ayuda.jsx';
import Clientes from '../Clientes.jsx';
import Balance from '../Balance.jsx';

const CUIT = { valido: ['green', 'válido'], invalido: ['red', 'inválido'], falta: ['sun', 'falta'] };
const TIPOS = { generador: 'Generador', comprador: 'Comprador', proveedor: 'Proveedor', ambos: 'Generador y comprador' };

function Padron() {
  const { data } = useLoad('/comercial/padron');
  if (!data) return null;
  const conMovimiento = data.items.filter((c) => c.comprado || c.vendido || c.cuitEstado !== 'valido');
  if (!conMovimiento.length) return null;
  return (
    <section className="card flush">
      <div className="card-head">
        <h3>Compras, ventas y CUIT<Ayuda>Lo que se le compró y vendió a cada uno, y el control del CUIT por su dígito verificador.</Ayuda></h3>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Nombre</th><th>Es</th><th>CUIT</th><th className="r">Le compraste</th><th className="r">Le vendiste</th></tr></thead>
          <tbody>
            {conMovimiento.map((c) => (
              <tr key={c._id}>
                <td>{c.razonSocial}{c.rubro && <div className="small muted">{c.rubro}</div>}</td>
                <td>{TIPOS[c.tipo]}</td>
                <td className="num">{c.cuit ?? ''} <span className={`tag ${CUIT[c.cuitEstado][0]}`}>{CUIT[c.cuitEstado][1]}</span></td>
                <td className="r num">{c.comprado ? <>{fmtKg(c.comprado.kg)}<div className="small muted">{fmtPeso(c.comprado.monto)}</div></> : '—'}</td>
                <td className="r num">{c.vendido ? <>{fmtKg(c.vendido.kg)}<div className="small muted">{fmtPeso(c.vendido.monto)}</div></> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ClientesYProveedores() {
  return (
    <div className="stack">
      <Clientes />
      <Padron />
    </div>
  );
}

const CONCEPTOS = ['Servicio a grandes generadores', 'Pago del municipio', 'Subsidio o programa', 'Otros ingresos'];

function IngresosCaja({ onCambio }) {
  const { data, reload } = useLoad('/ingresos-caja?limit=50');
  const [f, setF] = useState({ fecha: isoDate(), concepto: 'Pago del municipio', detalle: '', monto: '' });
  const [err, setErr] = useState(null);
  async function agregar(e) {
    e.preventDefault();
    setErr(null);
    try {
      await api('/ingresos-caja', { method: 'POST', body: { ...f, monto: Number(f.monto), detalle: f.detalle || undefined } });
      setF({ ...f, detalle: '', monto: '' });
      reload();
      onCambio();
    } catch (x) {
      setErr(x.message);
    }
  }
  return (
    <section className="card stack">
      <h3>Otros ingresos<Ayuda>Pago del municipio, subsidios, servicio a grandes generadores: lo que entra a la caja y no es venta de material ni cobro de una liquidación. Los egresos se cargan como gastos.</Ayuda></h3>
      <form className="form-grid" onSubmit={agregar}>
        <label>Fecha<input type="date" required value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></label>
        <label>
          Concepto
          <select value={f.concepto} onChange={(e) => setF({ ...f, concepto: e.target.value })}>
            {CONCEPTOS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label>Detalle<input type="text" value={f.detalle} onChange={(e) => setF({ ...f, detalle: e.target.value })} /></label>
        <label>Monto ($)<input type="number" min="0" step="any" required value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })} /></label>
        <div className="row" style={{ alignSelf: 'end' }}><button type="submit" className="secondary">Agregar</button></div>
      </form>
      {err && <p className="error" role="alert">{err}</p>}
      {data?.items.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Fecha</th><th>Concepto</th><th>Detalle</th><th className="r">Monto</th><th /></tr></thead>
            <tbody>
              {data.items.map((i) => (
                <tr key={i._id}>
                  <td>{fmtFecha(i.fecha)}</td>
                  <td>{i.concepto}</td>
                  <td>{i.detalle ?? '—'}</td>
                  <td className="r num">{fmtPeso(i.monto)}</td>
                  <td><ConfirmButton onConfirm={() => api(`/ingresos-caja/${i._id}`, { method: 'DELETE' }).then(() => { reload(); onCambio(); })}>Borrar</ConfirmButton></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function BalanceYCaja() {
  const [v, setV] = useState(0);
  const admin = ['admin', 'administracion'].includes(getUser()?.rol);
  return (
    <div className="stack">
      <Balance key={v} />
      {admin && <IngresosCaja onCambio={() => setV(v + 1)} />}
    </div>
  );
}
