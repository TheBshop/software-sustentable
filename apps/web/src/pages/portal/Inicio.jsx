import { useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtKg, getUser } from '../../api.js';
import { useLoad, ErrorMsg } from '../../ui.jsx';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const ANIOS = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i);

function Barras({ filas, label, extra }) {
  const max = Math.max(1, ...filas.map((f) => f.kg));
  return (
    <div className="bars">
      {filas.map((f) => (
        <div className="bar-row" key={f[label]}>
          <span className="bar-label" title={f[label]}>
            {f.hex && <span className="dot" style={{ background: f.hex }} aria-hidden="true" />} {f[label]}
          </span>
          <span className="bar-track"><span className="bar-fill" style={{ width: `${(f.kg / max) * 100}%` }} /></span>
          <span className="bar-value">{fmtKg(f.kg)}{extra?.(f)}</span>
        </div>
      ))}
      {!filas.length && <p className="muted">Sin datos en el año.</p>}
    </div>
  );
}

export default function PortalInicio() {
  const [anio, setAnio] = useState(ANIOS[0]);
  const { data, error } = useLoad(`/v1/portal/resumen?anio=${anio}`);
  const org = useLoad('/v1/portal/organizacion');
  const esMunicipio = getUser()?.organizacion?.tipo === 'municipio';
  const t = data?.totales;
  const maxMes = Math.max(1, ...(data?.porMes ?? []).map((m) => m.kg));

  return (
    <>
      <div className="view-head">
        <div>
          <h2>Impacto de la gestión de residuos</h2>
          <p className="muted">
            {org.data?.cooperativas?.length ? `Servicio prestado por ${org.data.cooperativas.join(' y ')}` : ''}
          </p>
        </div>
        <select aria-label="Año" value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
          {ANIOS.map((a) => <option key={a}>{a}</option>)}
        </select>
      </div>
      <ErrorMsg error={error} />
      {t && (
        <>
          <div className="kpis">
            <div className="kpi"><span>Material retirado</span><strong>{fmtKg(t.kg)}</strong></div>
            <div className="kpi"><span>Retiros</span><strong>{t.retiros}</strong></div>
            <div className="kpi green"><span>Valorizable</span><strong>{t.tasaValorizacion == null ? '—' : `${t.tasaValorizacion.toLocaleString('es-AR')} %`}</strong></div>
            <div className="kpi green"><span>CO₂ evitado (estimado)</span><strong>{fmtKg(t.co2EvitadoKg)}</strong></div>
            <div className="kpi"><span>Certificados emitidos</span><strong>{t.certificados}</strong></div>
            {data.separacion?.ingresadoKg > 0 && (
              <div className={`kpi ${data.separacion.tasaCorrecta < 90 ? 'alert' : 'green'}`} title="Parte de lo entregado que se pudo aprovechar, sin ir a disposición final">
                <span>Separación correcta</span>
                <strong>{data.separacion.tasaCorrecta.toLocaleString('es-AR')} %</strong>
                {data.separacion.rechazadoKg > 0 && <span className="small">{fmtKg(data.separacion.rechazadoKg)} descartados{data.separacion.causas.humedad ? ' (humedad)' : ''}</span>}
              </div>
            )}
          </div>

          <section className="card">
            <h3>Kilos retirados por mes</h3>
            <div className="columnas" role="img" aria-label="Gráfico de kilos por mes">
              {data.porMes.map((m) => (
                <div key={m.mes} className="columna">
                  <span className="columna-valor">{m.kg ? Math.round(m.kg).toLocaleString('es-AR') : ''}</span>
                  <span className="columna-barra" style={{ height: `${(m.kg / maxMes) * 100}%` }} />
                  <span className="columna-label">{MESES[m.mes - 1]}</span>
                </div>
              ))}
            </div>
          </section>

          <div className="grid2">
            <section className="card">
              <h3>Por fracción</h3>
              <p className="muted small">Código de colores del Decreto 779/2022.</p>
              <Barras filas={data.porFraccion} label="nombre" />
            </section>
            {esMunicipio && data.porSede.length > 0 ? (
              <section className="card">
                <h3>Por sede</h3>
                <Barras filas={data.porSede} label="sede" extra={(s) => <span className="muted small"> · {s.retiros} ret.</span>} />
              </section>
            ) : (
              <section className="card">
                <h3>Por material</h3>
                <Barras filas={data.porMaterial} label="material" />
              </section>
            )}
          </div>
          <p className="muted small">
            Para presentar en reportes de sustentabilidad, descargá el <Link to="/portal/informe">informe anual en PDF</Link>.
          </p>
        </>
      )}
    </>
  );
}
