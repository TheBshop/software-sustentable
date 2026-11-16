import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useLoad, ErrorMsg } from '../ui.jsx';

const TONO = { si: 'ok', condicional: 'medio', no: 'mal' };

/**
 * Clasificador de residuos en los tres niveles (nación, provincia, municipio).
 * `base`: '/clasificador' en el panel de la cooperativa, '/v1/portal/clasificador' en el portal.
 */
export default function Clasificar({ base = '/clasificador' }) {
  const cat = useLoad(`${base}/catalogo`);
  const [form, setForm] = useState(null);
  const [provincia, setProvincia] = useState('');
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);
  const c = cat.data;

  useEffect(() => {
    if (c && !form) elegir(0);
  }, [c]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!form) return;
    setErr(null);
    api(base, { method: 'POST', body: { nombre: form.nombre, origen: form.origen, cat: form.cat, h: form.h, y: form.y, riesgo: form.riesgo, ...(provincia && { provincia }) } })
      .then((r) => { setRes(r); if (!provincia) setProvincia(r.provincia); })
      .catch((e) => setErr(e.message));
  }, [form, provincia]); // eslint-disable-line react-hooks/exhaustive-deps

  function elegir(i) {
    if (i === 'otro') return setForm({ id: 'otro', nombre: '', origen: 'industria', cat: 'industrial', h: [], y: '', riesgo: 'bajo' });
    const x = c.catalogo[i];
    setForm({ ...x, h: [...x.h] });
  }
  const cambiar = (k, v) => setForm({ ...form, [k]: v, id: 'otro' });

  if (!c || !form) return <><h2>Clasificar residuos</h2><ErrorMsg error={cat.error} />{!cat.error && <p>Cargando…</p>}</>;
  return (
    <>
      <div className="view-head">
        <div>
          <h2>Clasificar residuos</h2>
          <p className="muted">Cómo se clasifica cada residuo en la nación, la provincia y el municipio, cómo se gestiona y si lo podés recibir.</p>
        </div>
        <div className="row">
          <select aria-label="Residuo" value={form.id} onChange={(e) => elegir(e.target.value === 'otro' ? 'otro' : Number(e.target.value))}>
            {c.catalogo.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
            <option value="otro">Otro residuo</option>
          </select>
          <select aria-label="Provincia" value={provincia} onChange={(e) => setProvincia(e.target.value)}>
            {Object.entries(c.provincias).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <ErrorMsg error={err} />
      <div className="cls">
        <section className="card stack">
          <label>Dónde se genera<select value={form.origen} onChange={(e) => cambiar('origen', e.target.value)}>{Object.entries(c.origenes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label>Qué es<select value={form.cat} onChange={(e) => cambiar('cat', e.target.value)}>{Object.entries(c.categorias).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          {form.cat === 'industrial' && (
            <label>Nivel de riesgo (Ley 25.612, art. 7)<select value={form.riesgo} onChange={(e) => cambiar('riesgo', e.target.value)}>{['bajo', 'medio', 'alto'].map((k) => <option key={k} value={k}>{k[0].toUpperCase() + k.slice(1)}</option>)}</select></label>
          )}
          <label>Corriente Y (Ley 24.051, Anexo I)<select value={form.y} onChange={(e) => cambiar('y', e.target.value)}><option value="">Ninguna</option>{Object.entries(c.corrientesY).map(([k, v]) => <option key={k} value={k}>{k} · {v}</option>)}</select></label>
          <fieldset className="h-grid">
            <legend>Características de peligrosidad (Anexo II)</legend>
            {Object.entries(c.caracteristicasH).map(([k, v]) => (
              <label key={k} className="check">
                <input type="checkbox" checked={form.h.includes(k)} onChange={(e) => cambiar('h', e.target.checked ? [...form.h, k] : form.h.filter((x) => x !== k))} />
                {k} · {v}
              </label>
            ))}
          </fieldset>
        </section>

        {res && (
          <div className="stack">
            {res.recibe && (
              <div className={`veredicto ${TONO[res.recibe.estado]}`}>
                <span className="small">¿Lo podés recibir?</span>
                <strong>{res.recibe.respuesta}</strong>
                {res.recibe.detalle && <span className="small">{res.recibe.detalle}</span>}
              </div>
            )}
            <div className="niveles">
              <div><span className="nivel">Nacional</span><b>{res.nacional[0]}</b><span className="muted small">{res.nacional[1]}</span></div>
              <div><span className="nivel">{c.provincias[res.provincia]}</span><b>{res.provincial}</b></div>
              <div><span className="nivel">Municipal</span><b>{res.municipal[0]}</b><span className="muted small">{res.municipal[1]}</span></div>
            </div>
            <div className="kpis">
              <div className="kpi"><span>Operación (Anexo III)</span><strong>{res.operacion.codigo}</strong><span className="small">{res.operacion.descripcion}</span></div>
              <div className={`kpi ${res.certificadoVerde ? 'green' : ''}`}><span>Certificado verde</span><strong>{res.certificadoVerde ? 'Corresponde' : 'No corresponde'}</strong></div>
            </div>
            <section className="card stack">
              <div><h3>Gestión</h3><p>{res.gestion}</p></div>
              {res.documentos.length > 0 && <div><h3>Documentos</h3><ul>{res.documentos.map((d) => <li key={d}>{d}</li>)}</ul></div>}
            </section>
          </div>
        )}
      </div>
    </>
  );
}
