import { useState } from 'react';
import { openPdf, fmtKg } from '../../api.js';
import { useLoad, ErrorMsg } from '../../ui.jsx';
import { ANIOS } from './Inicio.jsx';

export default function PortalInforme() {
  const [anio, setAnio] = useState(ANIOS[0]);
  const [err, setErr] = useState(null);
  const [descargando, setDescargando] = useState(false);
  const { data } = useLoad(`/v1/portal/resumen?anio=${anio}`);
  const constancias = useLoad(`/v1/portal/constancias?anio=${anio}`);

  async function descargar() {
    setErr(null);
    setDescargando(true);
    try {
      await openPdf(`/v1/portal/informe-anual.pdf?anio=${anio}`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setDescargando(false);
    }
  }

  return (
    <>
      <div className="view-head">
        <div>
          <h2>Informe anual</h2>
          <p className="muted">Un PDF con el impacto del año, listo para reportes de sustentabilidad, auditorías o rendiciones.</p>
        </div>
      </div>
      <section className="card stack" style={{ maxWidth: 560 }}>
        <label>
          Año
          <select value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
            {ANIOS.map((a) => <option key={a}>{a}</option>)}
          </select>
        </label>
        {data && (
          <p className="muted small">
            {data.totales.retiros} retiros · {fmtKg(data.totales.kg)} · {data.totales.certificados} certificados
          </p>
        )}
        <ul className="small">
          <li>Totales del año: kilos, retiros, porcentaje valorizable y CO₂ evitado.</li>
          <li>Gráfico de kilos por mes.</li>
          <li>Desglose por fracción (código de colores del Decreto 779/2022), por material y por sede.</li>
          <li>Cooperativas que prestaron el servicio y metodología de cálculo.</li>
        </ul>
        <ErrorMsg error={err} />
        <div className="row">
          <button type="button" onClick={descargar} disabled={descargando || !data?.totales.retiros}>
            {descargando ? 'Generando…' : `Descargar informe ${anio}`}
          </button>
          {data && !data.totales.retiros && <span className="muted small">No hay retiros en {anio}.</span>}
        </div>
      </section>

      <section className="card stack" style={{ maxWidth: 560 }}>
        <h3>Constancias de reciclado {anio}</h3>
        <p className="muted small">
          Firmadas por cada cooperativa: qué recibió y qué tratamiento le dio. Sirven de respaldo a la declaración jurada sobre reúso o reciclado de residuos
          que piden las autoridades ambientales (Ley 25.612, arts. 11 y 12).
        </p>
        {constancias.data?.items.map((c) => (
          <div key={c.cliente} className="row" style={{ justifyContent: 'space-between' }}>
            <span>{c.cooperativa} <span className="muted small">· {fmtKg(c.kg)} · {c.retiros} retiros</span></span>
            <button type="button" className="secondary sm" onClick={() => openPdf(`/v1/portal/constancias/${c.cliente}.pdf?anio=${anio}`).catch((e) => setErr(e.message))}>Descargar</button>
          </div>
        ))}
        {constancias.data && !constancias.data.items.length && <p className="muted small">No hay retiros en {anio}.</p>}
      </section>
    </>
  );
}
