// Inicio: indicadores del mes, avisos y lo que falta para empezar, según el perfil.
import { Link } from 'react-router-dom';
import { PROV, MUNI } from '@nueva-vida/catalogos';
import { useLoad, ErrorMsg } from '../../ui.jsx';
import Ayuda from '../../shell/Ayuda.jsx';

const AYUDAS = {
  ingresado: 'Todo lo que entró a la planta en el mes: retiros, recolección municipal, recuperadores y entregas.',
  vendido: 'Kilos vendidos en el mes, de las ventas registradas.',
  ventas: 'Monto de las ventas del mes (kg × precio por kg).',
  rechazo: 'Kilos rechazados sobre los ingresados. Más de 20% indica mala separación en origen.',
  toneladas: 'Toneladas recolectadas en el mes, de los registros de recolección.',
  diferenciada: 'Parte de lo recolectado que llegó separado (secos o húmedos).',
  disposicion: 'Parte de lo que tuvo destino que terminó en relleno sanitario o basural.',
  costoT: 'Costos del servicio cargados en el mes, divididos por las toneladas recolectadas.',
};

export function formatear(v, unidad) {
  if (v === null || v === undefined) return '—';
  const n = Number(v).toLocaleString('es-AR', { maximumFractionDigits: ['%', 't'].includes(unidad) ? 1 : 0 });
  return unidad === '$' ? `$ ${n}` : `${n} ${unidad}`;
}

export function ListaPasos({ pasos }) {
  return (
    <ul className="pasos">
      {pasos.map((p) => (
        <li key={p.id} className={`paso ${p.hecho ? 'hecho' : ''}`}>
          <span className="paso-check" aria-hidden="true">{p.hecho ? '✓' : ''}</span>
          <span className="paso-txt">{p.label}</span>
          {p.hecho ? <span className="sr-only">Hecho</span> : <Link className="button secondary sm" to={p.link}>Hacer</Link>}
        </li>
      ))}
    </ul>
  );
}

export default function Panel() {
  const { data, error } = useLoad('/panel');
  if (error) return <ErrorMsg error={error} />;
  if (!data) return <p className="muted">Cargando…</p>;
  const { organizacion: o, kpis, avisos, pasos } = data;
  const lugar = [o.jurisdiccion.municipio && MUNI[o.jurisdiccion.provincia]?.[o.jurisdiccion.municipio]?.n, PROV[o.jurisdiccion.provincia]?.[0]].filter(Boolean).join(', ');
  const hechos = pasos.filter((p) => p.hecho).length;
  const mes = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  return (
    <div className="stack">
      <div className="page-h">
        <div>
          <h2>{o.nombre}</h2>
          <p className="muted">{lugar || 'Sin jurisdicción configurada'} · {mes}</p>
        </div>
      </div>

      <div className="kpis">
        {kpis.map((k) => (
          <Link key={k.id} to={k.link} className={`kpi kpi-link ${k.tono ?? ''}`}>
            <span>{k.label}<Ayuda>{AYUDAS[k.id]}</Ayuda></span>
            <strong>{formatear(k.valor, k.unidad)}</strong>
          </Link>
        ))}
      </div>

      {avisos.length > 0 && (
        <section className="avisos" aria-label="Avisos">
          {avisos.map((a) => (
            <Link key={a.texto} to={a.link} className={`aviso ${a.tono}`}>
              <span>{a.texto}</span>
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </section>
      )}

      {hechos < pasos.length && (
        <section className="card stack">
          <div className="page-h">
            <h3>Cómo empezar</h3>
            <span className="small muted">{hechos} de {pasos.length}</span>
          </div>
          <div className="barra-prog" aria-hidden="true"><i style={{ width: `${(hechos / pasos.length) * 100}%` }} /></div>
          <ListaPasos pasos={pasos.filter((p) => !p.hecho).slice(0, 3)} />
          <Link to="/inicio/pasos" className="small">Ver todos los pasos</Link>
        </section>
      )}
    </div>
  );
}
