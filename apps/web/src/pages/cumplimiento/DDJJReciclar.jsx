import { useEffect, useState } from 'react';
import { api } from '../../api.js';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function DDJJReciclar() {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('resumen');

  useEffect(() => { api(`/ddjj-reciclar?anio=${anio}&mes=${mes}`).then(setData); }, [anio, mes]);

  if (!data) return <p>Cargando DDJJ...</p>;

  const { totales, porMaterial, compras, ventas, organizacion, periodo } = data;

  return (
    <div className="pant pant-ancha">
      <h1>DDJJ Comercializadores de Materiales a Reciclar</h1>
      <p className="ayuda-pant">RG ARCA 2849/2010 — Declaración jurada mensual de compras y ventas de materiales reciclables. Los datos se toman de los ingresos y ventas cargados en la plataforma.</p>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: '1.5rem' }}>
        <select value={mes} onChange={(e) => setMes(Number(e.target.value))}>
          {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
          {[anio - 1, anio, anio + 1].map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="kpis" style={{ marginBottom: '1.5rem' }}>
        <Kpi label="Compras (kg)" valor={fmt(totales.comprasKg)} />
        <Kpi label="Ventas (kg)" valor={fmt(totales.ventasKg)} />
        <Kpi label="Ventas ($)" valor={fmtArs(totales.ventasArs)} />
        <Kpi label="Operaciones" valor={totales.operaciones} />
      </div>

      <div className="barra-filtros" style={{ marginBottom: '1rem' }}>
        <button className={tab === 'resumen' ? 'activo' : ''} onClick={() => setTab('resumen')}>Resumen por material</button>
        <button className={tab === 'compras' ? 'activo' : ''} onClick={() => setTab('compras')}>Compras ({compras.length})</button>
        <button className={tab === 'ventas' ? 'activo' : ''} onClick={() => setTab('ventas')}>Ventas ({ventas.length})</button>
      </div>

      {tab === 'resumen' && <TablaResumen rows={porMaterial} />}
      {tab === 'compras' && <TablaCompras rows={compras} />}
      {tab === 'ventas' && <TablaVentas rows={ventas} />}

      <div style={{ marginTop: '2rem', padding: 16, background: 'var(--bg-sutil, #f9fafb)', borderRadius: 8, fontSize: 13, color: '#6b7280' }}>
        <strong>Organización:</strong> {organizacion.nombre} — CUIT {organizacion.cuit}<br />
        <strong>Período:</strong> {MESES[periodo.mes - 1]} {periodo.anio}
      </div>
    </div>
  );
}

function Kpi({ label, valor }) {
  return (
    <div className="kpi">
      <div className="kpi-valor">{valor}</div>
      <div className="kpi-titulo">{label}</div>
    </div>
  );
}

function TablaResumen({ rows }) {
  if (!rows.length) return <p style={{ color: '#9ca3af' }}>Sin operaciones en el período.</p>;
  return (
    <table className="tabla">
      <thead><tr><th>Material</th><th style={{ textAlign: 'right' }}>Compras (kg)</th><th style={{ textAlign: 'right' }}>Ventas (kg)</th><th style={{ textAlign: 'right' }}>Ventas ($)</th></tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}><td>{r.material}</td><td style={{ textAlign: 'right' }}>{fmt(r.comprasKg)}</td><td style={{ textAlign: 'right' }}>{fmt(r.ventasKg)}</td><td style={{ textAlign: 'right' }}>{fmtArs(r.ventasArs)}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

function TablaCompras({ rows }) {
  if (!rows.length) return <p style={{ color: '#9ca3af' }}>Sin compras en el período.</p>;
  return (
    <table className="tabla">
      <thead><tr><th>Fecha</th><th>Proveedor</th><th>CUIT</th><th>Material</th><th style={{ textAlign: 'right' }}>Peso (kg)</th></tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}><td>{fmtFecha(r.fecha)}</td><td>{r.proveedor}</td><td>{r.cuitProveedor || '—'}</td><td>{r.material}</td><td style={{ textAlign: 'right' }}>{fmt(r.pesoKg)}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

function TablaVentas({ rows }) {
  if (!rows.length) return <p style={{ color: '#9ca3af' }}>Sin ventas en el período.</p>;
  return (
    <table className="tabla">
      <thead><tr><th>Fecha</th><th>Comprador</th><th>CUIT</th><th>Material</th><th style={{ textAlign: 'right' }}>Peso (kg)</th><th style={{ textAlign: 'right' }}>$/kg</th><th style={{ textAlign: 'right' }}>Subtotal</th></tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}><td>{fmtFecha(r.fecha)}</td><td>{r.comprador}</td><td>{r.cuitComprador || '—'}</td><td>{r.material}</td><td style={{ textAlign: 'right' }}>{fmt(r.pesoKg)}</td><td style={{ textAlign: 'right' }}>{fmtArs(r.precioUnitario)}</td><td style={{ textAlign: 'right' }}>{fmtArs(r.subtotal)}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

const fmt = (n) => n?.toLocaleString('es-AR', { maximumFractionDigits: 2 }) ?? '—';
const fmtArs = (n) => n != null ? `$ ${fmt(n)}` : '—';
const fmtFecha = (f) => f ? new Date(f).toLocaleDateString('es-AR') : '—';
