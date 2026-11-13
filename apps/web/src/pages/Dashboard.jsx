import { useEffect, useState } from 'react';
import { api, fmtKg, fmtPeso } from '../api.js';

function Bars({ rows, label, value, format }) {
  const max = Math.max(...rows.map((r) => r[value]), 1);
  return (
    <div className="bars">
      {rows.map((r) => (
        <div className="bar-row" key={r[label]}>
          <span className="bar-label">{r[label]}</span>
          <span className="bar-track">
            <span className="bar-fill" style={{ width: `${(r[value] / max) * 100}%` }} />
          </span>
          <span className="bar-value">{format(r[value])}</span>
        </div>
      ))}
      {!rows.length && <p className="muted">Sin datos en el período</p>}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/dashboard').then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>Cargando…</p>;
  const t = data.totales;

  return (
    <>
      <h2>Resumen del mes</h2>
      <div className="kpis">
        <div className="kpi"><span>Retiros</span><strong>{t.retiros}</strong></div>
        <div className="kpi"><span>Material recuperado</span><strong>{fmtKg(t.kgRecuperados)}</strong></div>
        <div className="kpi"><span>CO₂ evitado</span><strong>{fmtKg(t.co2EvitadoKg)}</strong></div>
        <div className="kpi"><span>Ventas</span><strong>{fmtPeso(t.ventas)}</strong></div>
        <div className={`kpi ${t.cobrosVencidos > 0 ? 'alert' : ''}`}><span>Cobros vencidos</span><strong>{fmtPeso(t.cobrosVencidos)}</strong></div>
        <div className="kpi"><span>Vencen en 7 días</span><strong>{fmtPeso(t.cobrosPorVencer)}</strong></div>
      </div>
      <div className="grid2">
        <section className="card">
          <h3>Kg por material</h3>
          <Bars rows={data.porMaterial} label="material" value="kg" format={fmtKg} />
        </section>
        <section className="card">
          <h3>Kg por cliente</h3>
          <Bars rows={data.porCliente} label="cliente" value="kg" format={fmtKg} />
        </section>
      </div>
    </>
  );
}
