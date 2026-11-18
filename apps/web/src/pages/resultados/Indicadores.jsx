// Tablero de resultados: KPIs con variación vs. período anterior, desglose por fracción (donut)
// y evolución mensual por categoría (área apilada). Gráficos en SVG, sin librerías externas.
import { useMemo, useState } from 'react';
import { fmtKg, fmtPeso } from '../../api.js';
import { useLoad, ErrorMsg } from '../../ui.jsx';
import Ayuda from '../../shell/Ayuda.jsx';

const n = (v, d = 0) => (v == null ? '—' : Number(v).toLocaleString('es-AR', { maximumFractionDigits: d }));
const formatearValor = (k) => {
  if (k.valor == null) return '—';
  if (k.formato === 'pesos') return fmtPeso(k.valor);
  if (k.formato === 'entero') return n(k.valor);
  if (k.unidad === '%') return `${n(k.valor, 1)} %`;
  if (k.unidad === 'kg') return `${n(k.valor)} ${k.unidad}`;
  if (k.unidad === '$') return fmtPeso(k.valor);
  return n(k.valor);
};
const varSigno = (v, tono) => {
  if (v == null) return { tono: 'neutro', txt: '—' };
  const bueno = tono === 'malo' ? v < 0 : v >= 0;
  return { tono: bueno ? 'bueno' : 'malo', txt: `${v > 0 ? '+' : ''}${n(v, 2)} %` };
};

function Kpi({ k, grande, selected, onSelect }) {
  const v = varSigno(k.variacion, k.tono);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect())}
      className={`tb-kpi ${grande ? 'tb-kpi-g' : ''} ${selected ? 'tb-kpi-sel' : ''}`}
      aria-pressed={selected}
    >
      <span className="tb-kpi-l">
        {k.label}
        {k.ayuda && <Ayuda>{k.ayuda}</Ayuda>}
      </span>
      <strong>{formatearValor(k)}</strong>
      <span className={`tb-kpi-var tb-${v.tono}`} title={`vs. período anterior`}>
        <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
          <path d="M4 14l8-8 8 8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {v.txt}
        <span className="tb-kpi-var-sub">vs. período anterior</span>
      </span>
    </div>
  );
}

const TAU = Math.PI * 2;

/** Dona (anillo) para el desglose por fracción. Cada segmento con tooltip al pasar el mouse. */
function Donut({ data, total }) {
  const [hover, setHover] = useState(null);
  const R = 95;
  const r = 65;
  const CX = 110;
  const CY = 110;
  let acc = 0;
  const segs = data.map((d) => {
    const frac = total ? d.kg / total : 0;
    const a0 = acc;
    const a1 = acc + frac * TAU;
    acc = a1;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const x0 = CX + R * Math.cos(a0 - Math.PI / 2);
    const y0 = CY + R * Math.sin(a0 - Math.PI / 2);
    const x1 = CX + R * Math.cos(a1 - Math.PI / 2);
    const y1 = CY + R * Math.sin(a1 - Math.PI / 2);
    const x2 = CX + r * Math.cos(a1 - Math.PI / 2);
    const y2 = CY + r * Math.sin(a1 - Math.PI / 2);
    const x3 = CX + r * Math.cos(a0 - Math.PI / 2);
    const y3 = CY + r * Math.sin(a0 - Math.PI / 2);
    const path = `M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${r} ${r} 0 ${large} 0 ${x3} ${y3} Z`;
    return { ...d, path, frac };
  });
  const seleccionada = hover != null ? segs[hover] : null;
  return (
    <div className="tb-donut">
      <svg viewBox="0 0 220 220" role="img" aria-label="Desglose por fracción">
        {segs.map((s, i) => (
          <path
            key={s.fraccion}
            d={s.path}
            fill={s.color}
            opacity={hover == null || hover === i ? 1 : 0.35}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <title>{`${s.nombre}: ${fmtKg(s.kg)} (${n(s.pct, 1)} %)`}</title>
          </path>
        ))}
        {!segs.length && <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--borde)" strokeWidth="2" strokeDasharray="4 4" />}
        <text x={CX} y={CY - 6} textAnchor="middle" className="tb-donut-t">Total</text>
        <text x={CX} y={CY + 22} textAnchor="middle" className="tb-donut-v">{seleccionada ? `${n(seleccionada.pct, 1)} %` : fmtKg(total)}</text>
      </svg>
      <ul className="tb-leyenda">
        {data.map((d, i) => (
          <li key={d.fraccion} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <span className="tb-leyenda-c" style={{ background: d.color }} />
            <span className="tb-leyenda-n">{d.nombre}</span>
            <span className="tb-leyenda-p num">{n(d.pct, 1)} %</span>
          </li>
        ))}
        {!data.length && <li className="muted">Sin ingresos en el período.</li>}
      </ul>
    </div>
  );
}

/** Área apilada de 12 meses por serie. */
function Area({ meses, series }) {
  const W = 760;
  const H = 260;
  const P = { t: 10, r: 10, b: 28, l: 48 };
  const iw = W - P.l - P.r;
  const ih = H - P.t - P.b;
  const stacks = meses.map((_, i) => series.reduce((a, s) => a + s.valores[i], 0));
  const max = Math.max(1, ...stacks) * 1.1;
  const x = (i) => P.l + (i / (meses.length - 1 || 1)) * iw;
  const y = (v) => P.t + ih - (v / max) * ih;
  const [hover, setHover] = useState(null);

  // Build stacked path per series
  const acum = meses.map(() => 0);
  const paths = series.map((s) => {
    const puntos = s.valores.map((v, i) => [x(i), y(acum[i] + v)]);
    const base = s.valores.map((v, i) => [x(i), y(acum[i])]);
    for (let i = 0; i < meses.length; i += 1) acum[i] += s.valores[i];
    const d = `M ${puntos[0][0]} ${puntos[0][1]} ${puntos.slice(1).map(([px, py]) => `L ${px} ${py}`).join(' ')} ${base.reverse().map(([px, py]) => `L ${px} ${py}`).join(' ')} Z`;
    return { id: s.id, nombre: s.nombre, color: s.color, d };
  });

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Evolución mensual" width="100%">
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={P.l} y1={y(t)} x2={W - P.r} y2={y(t)} stroke="var(--borde)" strokeDasharray="2 3" />
            <text x={P.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--gris)">{n(t / 1000, 0)} t</text>
          </g>
        ))}
        {paths.map((p) => (
          <path key={p.id} d={p.d} fill={p.color} opacity="0.85">
            <title>{p.nombre}</title>
          </path>
        ))}
        {meses.map((m, i) => (
          <g key={m}>
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--gris)">{m}</text>
            <rect
              x={x(i) - iw / (meses.length * 2)}
              y={P.t}
              width={iw / meses.length}
              height={ih}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          </g>
        ))}
        {hover != null && (
          <g>
            <line x1={x(hover)} y1={P.t} x2={x(hover)} y2={P.t + ih} stroke="var(--tinta)" strokeWidth="1" strokeDasharray="2 3" />
          </g>
        )}
      </svg>
      <div className="tb-leg-h">
        {series.map((s) => (
          <span key={s.id}><span className="tb-leyenda-c" style={{ background: s.color }} /> {s.nombre}{hover != null && <span className="muted"> · {fmtKg(s.valores[hover])}</span>}</span>
        ))}
      </div>
    </div>
  );
}

const TABS = [
  { k: 'fraccion', label: 'Por fracción' },
  { k: 'material', label: 'Por material' },
  { k: 'cliente', label: 'Por cliente' },
];

export default function Indicadores() {
  const anio = new Date().getFullYear();
  const [periodo, setPeriodo] = useState(`${anio}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [tab, setTab] = useState('fraccion');
  const [kpi, setKpi] = useState('ingresado');
  const { data, error } = useLoad(`/resultados/panel?periodo=${periodo}`);
  const totalFrac = useMemo(() => (data?.fraccion ?? []).reduce((a, x) => a + x.kg, 0), [data]);

  if (error) return <ErrorMsg error={error} />;
  if (!data) return <p className="muted">Cargando…</p>;

  const seleccionado = [...data.principales, ...data.secundarias].find((k) => k.id === kpi) ?? data.principales[0];

  return (
    <div className="stack tb-stack">
      <div className="page-h">
        <div>
          <h2>Métricas</h2>
          <p className="muted">Período: {data.periodo.etiqueta}. Comparado con el período anterior.</p>
        </div>
        <label className="row">Período
          <input type="month" value={periodo.length === 7 ? periodo : `${anio}-01`} onChange={(e) => e.target.value && setPeriodo(e.target.value)} />
          <select value={periodo.length === 4 ? periodo : ''} onChange={(e) => e.target.value && setPeriodo(e.target.value)}>
            <option value="">Mes</option>
            <option value={`${anio}`}>Año {anio}</option>
            <option value={`${anio - 1}`}>Año {anio - 1}</option>
          </select>
        </label>
      </div>

      <div className="tb-row tb-row-g">
        {data.principales.map((k) => (
          <Kpi key={k.id} k={k} grande onSelect={() => setKpi(k.id)} selected={kpi === k.id} />
        ))}
      </div>
      <div className="tb-row">
        {data.secundarias.map((k) => (
          <Kpi key={k.id} k={k} onSelect={() => setKpi(k.id)} selected={kpi === k.id} />
        ))}
      </div>

      <section className="card tb-grid">
        <nav className="tb-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.k} type="button" role="tab" aria-selected={tab === t.k} className={tab === t.k ? 'active' : ''} onClick={() => setTab(t.k)}>{t.label}</button>
          ))}
        </nav>
        <div className="tb-grid-main">
          <div>
            <h3>Material ingresado por fracción</h3>
            {tab === 'fraccion' && <Donut data={data.fraccion} total={totalFrac} />}
            {tab === 'material' && (
              <ul className="tb-barras">
                {data.porMaterial.map((m) => {
                  const max = Math.max(...data.porMaterial.map((x) => x.kg), 1);
                  return (
                    <li key={m.materialId}>
                      <span className="tb-bar-l">{m.material}</span>
                      <span className="tb-bar-t"><span className="tb-bar-f" style={{ width: `${(m.kg / max) * 100}%`, background: m.color }} /></span>
                      <span className="tb-bar-v num">{fmtKg(m.kg)}</span>
                    </li>
                  );
                })}
                {!data.porMaterial.length && <li className="muted">Sin ingresos en el período.</li>}
              </ul>
            )}
            {tab === 'cliente' && (
              <ul className="tb-barras">
                {data.porCliente.map((c) => {
                  const max = Math.max(...data.porCliente.map((x) => x.kg), 1);
                  return (
                    <li key={c.clienteId}>
                      <span className="tb-bar-l">{c.cliente}</span>
                      <span className="tb-bar-t"><span className="tb-bar-f" style={{ width: `${(c.kg / max) * 100}%`, background: 'var(--verde)' }} /></span>
                      <span className="tb-bar-v num">{fmtKg(c.kg)}</span>
                    </li>
                  );
                })}
                {!data.porCliente.length && <li className="muted">Sin retiros a clientes en el período.</li>}
              </ul>
            )}
          </div>
          <div>
            <h3>Evolución mensual por fracción<span className="small muted"> · {data.evolucion.meses[0]}–{data.evolucion.meses[11]}</span></h3>
            <Area meses={data.evolucion.meses} series={data.evolucion.series} />
          </div>
        </div>
      </section>
    </div>
  );
}
