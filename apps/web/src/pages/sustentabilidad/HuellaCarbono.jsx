// Huella de carbono consolidada: emitido (servicios + combustible) vs evitado (materiales recuperados).
import { useEffect, useState } from 'react';
import { api } from '../../api.js';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function HuellaCarbono() {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [rep, setRep] = useState(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    setCargando(true);
    api(`/consumos/huella?anio=${anio}&mes=${mes}`).then(setRep).finally(() => setCargando(false));
  }, [anio, mes]);

  const fmt = (n) => Number(n ?? 0).toLocaleString('es-AR', { maximumFractionDigits: 1 });

  return (
    <div className="pant pant-ancha">
      <h1>Huella de carbono</h1>
      <p className="ayuda-pant">Balance mensual entre CO₂ <strong>evitado</strong> por recuperación de materiales y CO₂ <strong>emitido</strong> por consumos y combustible. Si el neto es positivo (verde), tu operación evita más emisiones de las que genera.</p>

      <div className="barra-filtros">
        <label>Año<input type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} style={{ width: 90 }} /></label>
        <label>Mes
          <select value={mes} onChange={(e) => setMes(Number(e.target.value))}>
            {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </label>
      </div>

      {cargando && <p>Cargando...</p>}
      {rep && (
        <>
          <div className="kpis">
            <div className="kpi" style={{ borderLeft: '4px solid #10b981' }}>
              <div className="kpi-titulo">Evitado</div>
              <div className="kpi-valor">{fmt(rep.evitado.totalKg)} kg CO₂</div>
            </div>
            <div className="kpi" style={{ borderLeft: '4px solid #ef4444' }}>
              <div className="kpi-titulo">Emitido</div>
              <div className="kpi-valor">{fmt(rep.emitido.totalKg)} kg CO₂</div>
            </div>
            <div className="kpi" style={{ borderLeft: `4px solid ${rep.esNegativo ? '#ef4444' : '#0f766e'}` }}>
              <div className="kpi-titulo">Balance neto</div>
              <div className="kpi-valor">{rep.netoKg > 0 ? '+' : ''}{fmt(rep.netoKg)} kg CO₂</div>
              <div className="kpi-sub">{rep.esNegativo ? 'La operación emite más de lo que evita' : 'Positivo: evitás más de lo que emitís'}</div>
            </div>
          </div>

          <div className="columnas-2">
            <Seccion titulo="Emitido por servicio" datos={rep.emitido.porServicio} />
            <Seccion titulo="Emitido por combustible" datos={rep.emitido.porCombustible} />
          </div>

          <h2>Evitado por material recuperado</h2>
          {rep.evitado.porMaterial.length === 0 ? <p className="ayuda">Sin ingresos a planta este mes.</p> : (
            <table className="tabla">
              <thead><tr><th>Material</th><th>kg procesados</th><th>kg CO₂ evitados</th></tr></thead>
              <tbody>
                {rep.evitado.porMaterial.map((m) => (
                  <tr key={m.codigo}>
                    <td>{m.nombre}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(m.kgProcesado)}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(m.kgCo2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}

function Seccion({ titulo, datos }) {
  const entries = Object.entries(datos || {});
  return (
    <div className="tarjeta">
      <h3>{titulo}</h3>
      {entries.length === 0 ? <p className="ayuda">Sin registros</p> : (
        <table className="tabla">
          <tbody>{entries.map(([k, v]) => (<tr key={k}><td>{k.replace('_', ' ')}</td><td style={{ textAlign: 'right' }}>{Number(v).toLocaleString('es-AR')} kg</td></tr>))}</tbody>
        </table>
      )}
    </div>
  );
}
