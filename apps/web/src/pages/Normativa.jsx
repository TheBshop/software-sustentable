import { useLoad, ErrorMsg, Tag } from '../ui.jsx';

function Norma({ n }) {
  return (
    <li className="norma">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong>{n.fuente ? <a href={n.fuente} target="_blank" rel="noreferrer">{n.norma}</a> : n.norma}</strong>
        {n.verificado ? <Tag tone="green">Verificada</Tag> : <Tag tone="sun">A verificar</Tag>}
      </div>
      <span className="muted small">{n.tema}</span>
      <p className="small">{n.resumen}</p>
    </li>
  );
}

function Bloque({ titulo, normas }) {
  if (!normas?.length) return null;
  return (
    <section className="card stack">
      <h3>{titulo}</h3>
      <ul className="normas">{normas.map((n) => <Norma key={n.norma} n={n} />)}</ul>
    </section>
  );
}

/** Marco normativo que aplica a la organización según su provincia y su municipio. */
export default function Normativa() {
  const { data, error } = useLoad('/normativa');
  const j = data?.jurisdiccion;
  const gg = data?.grandesGeneradores;
  return (
    <>
      <div className="view-head">
        <div>
          <h2>Marco normativo</h2>
          <p className="muted">
            {j?.provincia ? `${j.municipio ? `${j.municipio}, ` : ''}${j.provincia}${j.autoridad ? ` · Autoridad: ${j.autoridad}` : ''}` : 'Normas nacionales'}
          </p>
        </div>
      </div>
      <ErrorMsg error={error} />
      {data && !data.configurada && <div className="strip info-strip">Falta indicar la provincia y el municipio de la organización para mostrar sus normas locales.</div>}
      <div className="strip info-strip small">
        Resumen orientativo armado en noviembre de 2026. Las normas marcadas "A verificar" surgen de fuentes secundarias: confirmá el texto vigente con la autoridad antes de usarlas frente a un cliente.
      </div>
      {data?.notas.map((n) => <div key={n} className="strip alert-strip">{n}</div>)}

      {gg && (
        <section className="card stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3>Grandes generadores</h3>
            {gg.verificado ? <Tag tone="green">Verificado</Tag> : <Tag tone="sun">A verificar</Tag>}
          </div>
          {gg.norma && <span className="muted small">{gg.norma}</span>}
          <p>{gg.definicion}</p>
          {gg.obligaciones?.length > 0 && <ul className="small">{gg.obligaciones.map((o) => <li key={o}>{o}</li>)}</ul>}
          <p className="muted small">Son tus clientes potenciales: el certificado, el informe anual y la constancia de reciclado son los respaldos que necesitan para cumplir.</p>
        </section>
      )}

      {data?.cobertura?.length > 0 && (
        <section className="card flush">
          <div className="card-head"><h3>Qué cubre el sistema</h3><span className="muted small">Funciones que ayudan a cumplir cada exigencia</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Función</th><th>Dónde está</th><th>Normas</th></tr></thead>
              <tbody>
                {data.cobertura.map((c) => (
                  <tr key={c.clave}><td>{c.nombre}</td><td className="small">{c.donde}</td><td className="small">{c.normas.join(' · ')}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="grid2">
        <div className="stack">
          <Bloque titulo="Municipio" normas={data?.municipal} />
          <Bloque titulo="Provincia" normas={data?.provincial} />
        </div>
        <Bloque titulo="Nación" normas={data?.nacional} />
      </div>
    </>
  );
}
