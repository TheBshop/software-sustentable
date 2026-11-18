import { useLoad, ErrorMsg } from '../../ui.jsx';
import { ListaPasos } from './Panel.jsx';

export default function Pasos() {
  const { data, error } = useLoad('/panel');
  if (error) return <ErrorMsg error={error} />;
  if (!data) return <p className="muted">Cargando…</p>;
  const hechos = data.pasos.filter((p) => p.hecho).length;
  return (
    <div className="stack">
      <div className="page-h">
        <div>
          <h2>Cómo empezar</h2>
          <p className="muted">{hechos === data.pasos.length ? 'Todo listo.' : `${hechos} de ${data.pasos.length} pasos hechos. Cada paso se marca solo cuando lo completás.`}</p>
        </div>
      </div>
      <section className="card stack">
        <div className="barra-prog" aria-hidden="true"><i style={{ width: `${(hechos / data.pasos.length) * 100}%` }} /></div>
        <ListaPasos pasos={data.pasos} />
      </section>
    </div>
  );
}
