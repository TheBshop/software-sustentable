// Asistente de configuración: dónde trabaja la organización y qué residuos y tratamientos gestiona.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PROV, MUNI, RESIDUOS, CORR, GRUPOS, CONFIG_DEF } from '@nueva-vida/catalogos';
import { api } from '../api.js';
import { PERFILES, perfilDe } from '../shell/secciones.js';
import Ayuda from '../shell/Ayuda.jsx';

const toggle = (lista, k, on) => (on ? [...new Set([...lista, k])] : lista.filter((x) => x !== k));

export default function Bienvenida() {
  const navigate = useNavigate();
  const [org, setOrg] = useState(null);
  const [paso, setPaso] = useState(1);
  const [f, setF] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/planta/organizacion')
      .then((o) => {
        const def = CONFIG_DEF[perfilDe(o.tipo)];
        setOrg(o);
        setF({
          provincia: o.jurisdiccion?.provincia ?? 'entre_rios',
          municipio: o.jurisdiccion?.municipio ?? '',
          residuos: o.configuracion?.residuos ?? def.residuos,
          corrientes: o.configuracion?.corrientes ?? def.trat,
        });
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error" style={{ padding: 24 }}>{error}</p>;
  if (!f) return <div className="wiz-fondo" />;

  const perfil = perfilDe(org.tipo);
  const munis = Object.entries(MUNI[f.provincia] ?? {}).sort((a, b) => a[1].n.localeCompare(b[1].n, 'es'));

  async function guardar() {
    setError(null);
    try {
      await api('/planta/organizacion/configuracion', {
        method: 'PATCH',
        body: { provincia: f.provincia, ...(f.municipio && { municipio: f.municipio }), residuos: f.residuos, corrientes: f.corrientes, onboarding: true },
      });
      navigate('/panel', { replace: true });
    } catch (e) {
      setError(e.message);
    }
  }
  function despues() {
    try {
      localStorage.setItem(`saltar-asistente-${org.id}`, 'true');
    } catch {
      /* sin almacenamiento: el asistente vuelve a aparecer */
    }
    navigate('/panel', { replace: true });
  }

  return (
    <div className="wiz-fondo">
      <div className="wiz card">
        <div className="wiz-top">
          <span className="tag green">{PERFILES[perfil]} · {org.nombre}</span>
          <span className="small muted">Paso {paso} de 2</span>
        </div>
        <div className="barra-prog" aria-hidden="true"><i style={{ width: `${paso * 50}%` }} /></div>
        {paso === 1 ? (
          <>
            <div>
              <h2>¿Dónde trabajás?</h2>
              <p className="muted">Define qué normativa provincial y municipal te aplica.</p>
            </div>
            <div className="form-grid">
              <label>
                Provincia
                <select value={f.provincia} onChange={(e) => setF({ ...f, provincia: e.target.value, municipio: '' })}>
                  {Object.entries(PROV).map(([k, [n]]) => <option key={k} value={k}>{n}</option>)}
                </select>
              </label>
              <label>
                Municipio
                <select value={f.municipio} onChange={(e) => setF({ ...f, municipio: e.target.value })}>
                  <option value="">Otro o no está en la lista</option>
                  {munis.map(([k, m]) => <option key={k} value={k}>{m.n}</option>)}
                </select>
              </label>
            </div>
          </>
        ) : (
          <>
            <div>
              <h2>¿Qué trabajás?</h2>
              <p className="muted">Marcá lo que corresponda. Lo podés cambiar cuando quieras volviendo a este asistente.</p>
            </div>
            <h3>Residuos que gestionás</h3>
            <div className="check-grid">
              {Object.entries(RESIDUOS).map(([k, v]) => (
                <label key={k} className="check">
                  <input type="checkbox" checked={f.residuos.includes(k)} onChange={(e) => setF({ ...f, residuos: toggle(f.residuos, k, e.target.checked) })} /> {v}
                </label>
              ))}
            </div>
            <h3>
              Tratamientos que hacés
              <Ayuda>Cada tratamiento suma sus obligaciones, registros y parámetros de control (por ejemplo, el compostaje pide registro de temperatura).</Ayuda>
            </h3>
            <div>
              {Object.entries(GRUPOS).map(([g, gn]) => {
                const ids = Object.keys(CORR).filter((id) => CORR[id].g === g);
                const n = ids.filter((id) => f.corrientes.includes(id)).length;
                return (
                  <details key={g} open={n > 0}>
                    <summary>{gn}{n > 0 && <span className="tag green" style={{ marginLeft: 8 }}>{n}</span>}</summary>
                    <div className="check-grid">
                      {ids.map((id) => (
                        <label key={id} className="check">
                          <input type="checkbox" checked={f.corrientes.includes(id)} onChange={(e) => setF({ ...f, corrientes: toggle(f.corrientes, id, e.target.checked) })} /> {CORR[id].n}
                        </label>
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          </>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="wiz-pie">
          {paso === 1 ? <button type="button" className="link" onClick={despues}>Completar después</button> : <button type="button" className="secondary" onClick={() => setPaso(1)}>Volver</button>}
          {paso === 1 ? <button type="button" onClick={() => setPaso(2)}>Siguiente</button> : <button type="button" onClick={guardar} disabled={!f.residuos.length}>Listo, ir al panel</button>}
        </div>
      </div>
    </div>
  );
}
