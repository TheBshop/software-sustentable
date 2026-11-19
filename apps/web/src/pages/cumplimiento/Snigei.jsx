import { useEffect, useState } from 'react';
import { api, descargar } from '../../api.js';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function Snigei() {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [rep, setRep] = useState(null);
  const [cargando, setCargando] = useState(false);

  async function cargar() {
    setCargando(true);
    try {
      const r = await api(`/api/snigei/mensual?anio=${anio}&mes=${mes}`);
      setRep(r);
    } finally { setCargando(false); }
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [anio, mes]);

  const fmt = (n) => Number(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="pant pant-ancha">
      <h1>Reporte mensual (SNIGEI)</h1>
      <p className="ayuda-pant">Agrega los ingresos a planta del mes por corriente, fracción y tratamiento. Formato final a verificar con el formulario oficial vigente del organismo nacional.</p>

      <div className="barra-filtros">
        <label>Año
          <input type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} style={{ width: 90 }} />
        </label>
        <label>Mes
          <select value={mes} onChange={(e) => setMes(Number(e.target.value))}>
            {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </label>
        <button onClick={() => descargar(`/api/snigei/mensual.xlsx?anio=${anio}&mes=${mes}`, `snigei-${anio}-${String(mes).padStart(2, '0')}.xlsx`)} disabled={!rep}>Descargar Excel</button>
      </div>

      {cargando && <p>Cargando...</p>}
      {rep && (
        <>
          <div className="kpis">
            <Kpi titulo="Ingreso total" valor={`${rep.totales.ingresoTn} tn`} subtitulo={`${fmt(rep.totales.ingresoKg)} kg`} />
            <Kpi titulo="Recuperado" valor={`${fmt(rep.totales.recuperadoKg)} kg`} />
            <Kpi titulo="Disposición final" valor={`${fmt(rep.totales.disposicionFinalKg)} kg`} />
            <Kpi titulo="Tasa de recuperación" valor={`${rep.totales.tasaRecuperacionPct}%`} />
          </div>

          <div className="columnas-2">
            <Seccion titulo="Por corriente" datos={rep.porCorriente} />
            <Seccion titulo="Por fracción (RSU)" datos={rep.porFraccion} />
            <Seccion titulo="Por tratamiento" datos={rep.porTratamiento} />
            <Seccion titulo="Por categoría" datos={rep.porCategoria} />
          </div>

          <h2>Detalle por material</h2>
          <table className="tabla">
            <thead><tr><th>Código</th><th>Material</th><th>Corriente</th><th>Tratamiento</th><th>Ingreso (kg)</th><th>Venta (kg)</th></tr></thead>
            <tbody>
              {rep.porMaterial.map((m) => (
                <tr key={m.codigo}>
                  <td>{m.codigo}</td>
                  <td>{m.nombre}</td>
                  <td>{m.corriente}</td>
                  <td>{m.tratamiento || '—'}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(m.ingresoKg)}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(m.ventaKg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function Kpi({ titulo, valor, subtitulo }) {
  return <div className="kpi"><div className="kpi-titulo">{titulo}</div><div className="kpi-valor">{valor}</div>{subtitulo && <div className="kpi-sub">{subtitulo}</div>}</div>;
}

function Seccion({ titulo, datos }) {
  const entries = Object.entries(datos || {});
  if (!entries.length) return <div className="tarjeta"><h3>{titulo}</h3><p className="ayuda">Sin datos</p></div>;
  return (
    <div className="tarjeta">
      <h3>{titulo}</h3>
      <table className="tabla">
        <tbody>{entries.map(([k, v]) => (<tr key={k}><td>{k}</td><td style={{ textAlign: 'right' }}>{Number(v).toLocaleString('es-AR')} kg</td></tr>))}</tbody>
      </table>
    </div>
  );
}
