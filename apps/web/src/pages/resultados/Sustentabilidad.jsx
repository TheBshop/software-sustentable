// Sustentabilidad: huella de carbono (Alcances 1 y 2), emisiones evitadas (EPA WARM)
// y memoria anual con PDF y Excel.
import { useState } from 'react';
import { fmtKg, fmtPeso, descargar, openPdf } from '../../api.js';
import { useLoad, ErrorMsg } from '../../ui.jsx';
import Ayuda from '../../shell/Ayuda.jsx';

const n = (v, d = 0) => (v == null ? '—' : Number(v).toLocaleString('es-AR', { maximumFractionDigits: d }));
const t = (kg) => (kg == null ? '—' : `${n(kg / 1000, 1)} t`);

function Huella({ anio }) {
  const { data, error } = useLoad(`/resultados/huella?anio=${anio}`);
  if (error) return <ErrorMsg error={error} />;
  if (!data) return <p className="muted">Cargando…</p>;
  return (
    <div className="stack">
      <div className="kpis">
        <div className="kpi"><span>Alcance 1 · combustibles<Ayuda>Gasoil, nafta y GNC cargados en Registros › Combustible. Fuente: SNIGEI-AR 2025.</Ayuda></span><strong>{n(data.total.a1)} kg CO₂e</strong></div>
        <div className="kpi"><span>Alcance 2 · electricidad<Ayuda>Factor de la red nacional publicado por la Subsecretaría de Ambiente.</Ayuda></span><strong>{n(data.total.a2)} kg CO₂e</strong></div>
        <div className="kpi"><span>Huella {data.anio}</span><strong>{n(data.total.kg)} kg CO₂e</strong></div>
        <div className="kpi"><span>Por tonelada ingresada</span><strong>{data.total.porTonelada == null ? '—' : `${n(data.total.porTonelada, 1)} kg CO₂e por t`}</strong></div>
      </div>
      <div className="card flush table-wrap">
        <table>
          <thead><tr><th>Mes</th><th className="r">Alcance 1</th><th className="r">Alcance 2</th><th className="r">Total</th><th className="r">t ingresadas</th><th className="r">kg CO₂e / t</th></tr></thead>
          <tbody>
            {data.filas.map((f) => (
              <tr key={f.mes}>
                <td>{new Date(`${f.mes}-15`).toLocaleDateString('es-AR', { month: 'long' })}</td>
                <td className="r num">{n(f.a1)}</td>
                <td className="r num">{n(f.a2)}</td>
                <td className="r num">{n(f.total)}</td>
                <td className="r num">{n(f.t, 2)}</td>
                <td className="r num">{f.t ? n((f.a1 + f.a2) / f.t, 1) : '—'}</td>
              </tr>
            ))}
            {!data.filas.length && <tr><td colSpan={6} className="muted">Sin combustible ni electricidad cargados en el año. Cargalos en Registros.</td></tr>}
          </tbody>
        </table>
      </div>
      {data.total.bio > 0 && <p className="small muted">Además, {n(data.total.bio)} kg de CO₂ biogénico (biodiésel y bioetanol): se informa aparte y no suma a la huella.</p>}
      <p className="small muted">Fuente: {data.fuente.nombre} (<a href={data.fuente.url} target="_blank" rel="noreferrer">PDF</a>). CO₂e = CO₂ + {data.fuente.pcg.ch4}·CH₄ + {data.fuente.pcg.n2o}·N₂O (AR5 del IPCC).</p>
    </div>
  );
}

function Evitadas({ anio }) {
  const { data, error } = useLoad(`/resultados/evitadas?anio=${anio}`);
  if (error) return <ErrorMsg error={error} />;
  if (!data) return <p className="muted">Cargando…</p>;
  return (
    <div className="stack">
      <div className="kpis">
        <div className="kpi"><span>Emisiones evitadas {data.anio}<Ayuda>Factores de EPA WARM v16. Es una estimación del impacto evitado por reciclar en lugar de disponer en relleno.</Ayuda></span><strong>{t(data.total.evitadoKg)} CO₂e</strong></div>
        <div className="kpi"><span>De eso, carbono forestal<Ayuda>Beneficio adicional del reciclado de papel y cartón: menos presión sobre bosques.</Ayuda></span><strong>{t(data.total.bosqueKg)}</strong></div>
        <div className="kpi"><span>Kg vendidos sin factor</span><strong>{fmtKg(data.total.sinFactorKg)}</strong></div>
      </div>
      <div className="card flush table-wrap">
        <table>
          <thead><tr><th>Material</th><th className="r">Kg vendidos</th><th>Factor (EPA WARM)</th><th className="r">kg CO₂e / kg</th><th className="r">Evitado</th></tr></thead>
          <tbody>
            {data.filas.map((f) => (
              <tr key={f.material}>
                <td>{f.material ?? '—'}</td>
                <td className="r num">{fmtKg(f.kg)}</td>
                <td className="small">{f.factor ? `${f.factor.nombre} · ${n(f.factor.st, 2)} t/t corta` : <span className="tag gray">sin factor</span>}</td>
                <td className="r num">{f.factor ? n(f.factor.kg, 2) : '—'}</td>
                <td className="r num">{f.evitado == null ? '—' : `${n(f.evitado)} kg`}</td>
              </tr>
            ))}
            {!data.filas.length && <tr><td colSpan={5} className="muted">Sin ventas en el año.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="small muted">Fuente: {data.fuente.nombre} (<a href={data.fuente.url} target="_blank" rel="noreferrer">PDF</a>).</p>
    </div>
  );
}

function PorCliente({ anio }) {
  const { data, error } = useLoad(`/resultados/informe-clientes?anio=${anio}`);
  if (error) return <ErrorMsg error={error} />;
  if (!data) return <p className="muted">Cargando…</p>;
  return (
    <div className="card flush table-wrap">
      <table>
        <thead><tr><th>Cliente</th><th>Materiales</th><th className="r">Kg del año</th><th className="r">Certificados</th><th className="r">CO₂ evitado</th></tr></thead>
        <tbody>
          {data.items.map((c) => (
            <tr key={c.clienteId}>
              <td>{c.cliente}</td>
              <td className="small">{c.materiales.map((m) => `${m.material}: ${fmtKg(m.kg)}`).join(' · ')}</td>
              <td className="r num">{fmtKg(c.kgTotal)}</td>
              <td className="r num">{c.certificados}</td>
              <td className="r num">{n(c.co2EvitadoKg)} kg</td>
            </tr>
          ))}
          {!data.items.length && <tr><td colSpan={5} className="muted">Sin retiros registrados a generadores en el año.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function Memoria({ anio }) {
  const { data, error } = useLoad(`/resultados/memoria?anio=${anio}`);
  if (error) return <ErrorMsg error={error} />;
  if (!data) return <p className="muted">Cargando…</p>;
  const T = data.totales;
  return (
    <div className="stack">
      <div className="row">
        <button type="button" onClick={() => openPdf(`/resultados/memoria.pdf?anio=${anio}`)}>Descargar PDF</button>
        <button type="button" className="secondary" onClick={() => descargar(`/resultados/memoria.xlsx?anio=${anio}`, `memoria-${anio}.xlsx`)}>Descargar Excel</button>
      </div>
      <div className="kpis">
        <div className="kpi"><span>Ingresado</span><strong>{t(T.ingresadoKg)}</strong></div>
        <div className="kpi"><span>Vendido</span><strong>{t(T.vendidoKg)}</strong></div>
        <div className="kpi"><span>A disposición final</span><strong>{t(T.rechazoKg)}</strong></div>
        <div className="kpi"><span>Valorización</span><strong>{T.valorizacion == null ? '—' : `${n(T.valorizacion, 1)} %`}</strong></div>
        <div className="kpi"><span>Facturado</span><strong>{fmtPeso(T.monto)}</strong></div>
      </div>
      <div className="grid2">
        <section className="card stack">
          <h3>Ingresos por origen</h3>
          <table><tbody>{data.porOrigen.map((o) => <tr key={o.origen}><td>{o.origen ?? '—'}</td><td className="r num">{fmtKg(o.kg)}</td></tr>)}</tbody></table>
        </section>
        <section className="card stack">
          <h3>Rechazo por causa</h3>
          <table><tbody>{data.porCausa.map((c) => <tr key={c.causa}><td>{c.causa}</td><td className="r num">{fmtKg(c.kg)}</td></tr>)}{!data.porCausa.length && <tr><td className="muted">Sin rechazo registrado.</td></tr>}</tbody></table>
        </section>
      </div>
      <section className="card stack">
        <h3>Ventas por material</h3>
        <table>
          <thead><tr><th>Material</th><th className="r">Kg</th><th className="r">Importe</th></tr></thead>
          <tbody>{data.ventasMaterial.map((v) => <tr key={v.material}><td>{v.material}</td><td className="r num">{fmtKg(v.kg)}</td><td className="r num">{fmtPeso(v.monto)}</td></tr>)}</tbody>
        </table>
      </section>
      <section className="card stack">
        <h3>Principales compradores</h3>
        <table><tbody>{data.compradores.map((c) => <tr key={c.comprador}><td>{c.comprador}</td><td className="r num">{fmtKg(c.kg)}</td></tr>)}{!data.compradores.length && <tr><td className="muted">Sin ventas.</td></tr>}</tbody></table>
      </section>
    </div>
  );
}

const TABS = { huella: 'Huella de carbono', evitadas: 'Emisiones evitadas', clientes: 'Informe por cliente', memoria: 'Memoria anual' };

export default function Sustentabilidad() {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [tab, setTab] = useState('huella');
  const Vista = { huella: Huella, evitadas: Evitadas, clientes: PorCliente, memoria: Memoria }[tab];
  return (
    <div className="stack">
      <div className="page-h">
        <div>
          <h2>Sustentabilidad y memoria<Ayuda>Huella de carbono con factores SNIGEI-AR 2025, emisiones evitadas con EPA WARM v16, informe por cliente y memoria anual exportable.</Ayuda></h2>
        </div>
        <label className="row">Año<input type="number" min="2000" max="3000" value={anio} onChange={(e) => e.target.value && setAnio(Number(e.target.value))} style={{ width: 100 }} /></label>
      </div>
      <nav className="subnav" style={{ borderBottom: '1px solid var(--borde)' }}>
        {Object.entries(TABS).map(([k, v]) => (
          <button key={k} type="button" className={tab === k ? 'active' : ''} onClick={() => setTab(k)} style={{ background: 'none', border: 'none', color: tab === k ? 'var(--tinta)' : 'var(--gris)', boxShadow: tab === k ? 'inset 0 -2px 0 var(--verde)' : 'none', padding: 12, fontWeight: 500 }}>
            {v}
          </button>
        ))}
      </nav>
      <Vista key={`${tab}-${anio}`} anio={anio} />
    </div>
  );
}
