// Contabilidad para el contador: Libro IVA Ventas, Libro IVA Compras y Mayor,
// exportables en .xlsx. Reemplaza buena parte de lo que el cliente hoy saca de Odoo.
import { useState } from 'react';
import { descargar, fmtFecha, fmtPeso, isoDate } from '../../api.js';
import { useLoad, ErrorMsg } from '../../ui.jsx';
import Ayuda from '../../shell/Ayuda.jsx';

const TABS = {
  ventas: { label: 'Libro IVA Ventas', url: '/contabilidad/libro-iva-ventas' },
  compras: { label: 'Libro IVA Compras', url: '/contabilidad/libro-iva-compras' },
  mayor: { label: 'Mayor', url: '/contabilidad/mayor' },
};
const CUENTAS = { caja: 'Caja', ventas: 'Ventas', gastos: 'Gastos', clientes: 'Clientes' };

function Rango({ value, onChange }) {
  return (
    <div className="row small">
      <label>Desde<input type="date" value={value.desde} onChange={(e) => onChange({ ...value, desde: e.target.value })} /></label>
      <label>Hasta<input type="date" value={value.hasta} onChange={(e) => onChange({ ...value, hasta: e.target.value })} /></label>
    </div>
  );
}

function LibroIva({ url, rango, columnas }) {
  const q = `?desde=${rango.desde}&hasta=${rango.hasta}`;
  const { data, error } = useLoad(`${url}${q}`);
  if (error) return <ErrorMsg error={error} />;
  if (!data) return <p className="muted">Cargando…</p>;
  return (
    <div className="stack">
      <div className="row">
        <button type="button" onClick={() => descargar(`${url}.xlsx${q}`, `${url.split('/').pop()}_${rango.desde}_${rango.hasta}.xlsx`)}>Descargar Excel</button>
      </div>
      <div className="card flush table-wrap">
        <table>
          <thead><tr>{columnas.map((c) => <th key={c.k} className={c.align === 'r' ? 'r' : undefined}>{c.label}</th>)}</tr></thead>
          <tbody>
            {data.items.map((fila, i) => (
              <tr key={i}>{columnas.map((c) => <td key={c.k} className={c.align === 'r' ? 'r num' : ''}>{c.render ? c.render(fila[c.k], fila) : fila[c.k] ?? '—'}</td>)}</tr>
            ))}
            {!data.items.length && <tr><td colSpan={columnas.length} className="muted">Sin movimientos en el período.</td></tr>}
          </tbody>
          {data.totales && (
            <tfoot>
              <tr><td colSpan={columnas.length - 1}><b>Totales</b></td><td className="r num"><b>{fmtPeso(data.totales.total ?? 0)}</b></td></tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function Mayor({ rango }) {
  const [cuenta, setCuenta] = useState('caja');
  const q = `?cuenta=${cuenta}&desde=${rango.desde}&hasta=${rango.hasta}`;
  const { data, error } = useLoad(`/contabilidad/mayor${q}`);
  return (
    <div className="stack">
      <div className="row">
        <label>Cuenta
          <select value={cuenta} onChange={(e) => setCuenta(e.target.value)}>
            {Object.entries(CUENTAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => descargar(`/contabilidad/mayor.xlsx${q}`, `mayor_${cuenta}_${rango.desde}_${rango.hasta}.xlsx`)}>Descargar Excel</button>
      </div>
      {error && <ErrorMsg error={error} />}
      {data && (
        <div className="card flush table-wrap">
          <table>
            <thead><tr><th>Fecha</th><th>Concepto</th><th className="r">Debe</th><th className="r">Haber</th><th className="r">Saldo</th></tr></thead>
            <tbody>
              {data.items.map((m, i) => (
                <tr key={i}>
                  <td>{fmtFecha(m.fecha)}</td>
                  <td>{m.concepto}{m.detalle && <div className="small muted">{m.detalle}</div>}</td>
                  <td className="r num">{m.debe ? fmtPeso(m.debe) : ''}</td>
                  <td className="r num">{m.haber ? fmtPeso(m.haber) : ''}</td>
                  <td className="r num">{fmtPeso(m.saldo)}</td>
                </tr>
              ))}
              {!data.items.length && <tr><td colSpan={5} className="muted">Sin movimientos en el período.</td></tr>}
            </tbody>
            <tfoot>
              <tr><td colSpan={4}><b>Saldo al cierre</b></td><td className="r num"><b>{fmtPeso(data.saldoFinal ?? 0)}</b></td></tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

const COLS_VENTAS = [
  { k: 'fecha', label: 'Fecha', render: (v) => fmtFecha(v) },
  { k: 'comprobante', label: 'Comprobante' },
  { k: 'cliente', label: 'Cliente' },
  { k: 'cuit', label: 'CUIT' },
  { k: 'condicionIva', label: 'Cond. IVA' },
  { k: 'neto', label: 'Neto', align: 'r', render: (v) => fmtPeso(v) },
  { k: 'iva21', label: 'IVA 21%', align: 'r', render: (v) => fmtPeso(v) },
  { k: 'iva105', label: 'IVA 10,5%', align: 'r', render: (v) => fmtPeso(v) },
  { k: 'exento', label: 'Exento', align: 'r', render: (v) => fmtPeso(v) },
  { k: 'percepciones', label: 'Percep.', align: 'r', render: (v) => fmtPeso(v) },
  { k: 'total', label: 'Total', align: 'r', render: (v) => fmtPeso(v) },
];
const COLS_COMPRAS = [
  { k: 'fecha', label: 'Fecha', render: (v) => fmtFecha(v) },
  { k: 'comprobante', label: 'Comprobante' },
  { k: 'proveedor', label: 'Proveedor' },
  { k: 'cuit', label: 'CUIT' },
  { k: 'condicionIva', label: 'Cond. IVA' },
  { k: 'neto', label: 'Neto', align: 'r', render: (v) => fmtPeso(v) },
  { k: 'iva21', label: 'IVA 21%', align: 'r', render: (v) => fmtPeso(v) },
  { k: 'otrosImpuestos', label: 'Otros imp.', align: 'r', render: (v) => fmtPeso(v) },
  { k: 'total', label: 'Total', align: 'r', render: (v) => fmtPeso(v) },
];

export default function Contabilidad() {
  const hoy = isoDate();
  const mesIni = hoy.slice(0, 8) + '01';
  const [rango, setRango] = useState({ desde: mesIni, hasta: hoy });
  const [tab, setTab] = useState('ventas');
  return (
    <div className="stack">
      <div className="page-h">
        <div>
          <h2>Contabilidad<Ayuda>Lo que tu contador necesita. Libros IVA del período y Mayor por cuenta, exportable a Excel. Los datos salen de las ventas, compras, gastos, cobros e ingresos de caja que ya cargás.</Ayuda></h2>
          <p className="muted">Libros IVA y Mayor, listos para el contador.</p>
        </div>
        <Rango value={rango} onChange={setRango} />
      </div>
      <nav className="subnav" style={{ borderBottom: '1px solid var(--borde)' }}>
        {Object.entries(TABS).map(([k, t]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={tab === k ? 'active' : ''} style={{ background: 'none', border: 'none', padding: 12, color: tab === k ? 'var(--tinta)' : 'var(--gris)', boxShadow: tab === k ? 'inset 0 -2px 0 var(--verde)' : 'none', fontWeight: 500 }}>
            {t.label}
          </button>
        ))}
      </nav>
      {tab === 'ventas' && <LibroIva key={`v-${rango.desde}-${rango.hasta}`} url="/contabilidad/libro-iva-ventas" rango={rango} columnas={COLS_VENTAS} />}
      {tab === 'compras' && <LibroIva key={`c-${rango.desde}-${rango.hasta}`} url="/contabilidad/libro-iva-compras" rango={rango} columnas={COLS_COMPRAS} />}
      {tab === 'mayor' && <Mayor key={`m-${rango.desde}-${rango.hasta}`} rango={rango} />}
    </div>
  );
}
