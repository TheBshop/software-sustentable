import { useState } from 'react';
import { openPdf, fmtKg } from '../../api.js';
import { useLoad, ErrorMsg } from '../../ui.jsx';
import { ANIOS } from './Inicio.jsx';

export default function PortalInforme() {
  const [anio, setAnio] = useState(ANIOS[0]);
  const [err, setErr] = useState(null);
  const [descargando, setDescargando] = useState(false);
  const { data } = useLoad(`/v1/portal/resumen?anio=${anio}`);

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
    </>
  );
}
