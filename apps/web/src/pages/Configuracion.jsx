import { useEffect, useState } from 'react';
import { api, apiForm, fileUrl } from '../api.js';
import { useLoad, ErrorMsg, Tag } from '../ui.jsx';
import { CORRIENTES } from '../residuos.jsx';

/** Datos de la cooperativa que aparecen en los certificados: responsable, firma y sello. */
export default function Configuracion() {
  const { data, error, reload } = useLoad('/planta/organizacion');
  const [form, setForm] = useState({ responsable: '', cargo: '' });
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (data) setForm({ responsable: data.certificado?.responsable ?? '', cargo: data.certificado?.cargo ?? '' });
  }, [data]);

  async function guardar(e) {
    e.preventDefault();
    setErr(null);
    try {
      await api('/planta/organizacion', { method: 'PATCH', body: form });
      setMsg('Datos guardados. Se usan en los próximos certificados.');
      await reload();
    } catch (e2) {
      setErr(e2.message);
    }
  }

  async function subir(tipo, file) {
    if (!file) return;
    setErr(null);
    if (!['image/png', 'image/jpeg'].includes(file.type)) return setErr('Subí una imagen PNG o JPG.');
    if (file.size > 2 * 1024 * 1024) return setErr('La imagen tiene que pesar menos de 2 MB.');
    const fd = new FormData();
    fd.append('imagen', file);
    try {
      await apiForm(`/planta/organizacion/${tipo}`, fd);
      setMsg(`${tipo === 'firma' ? 'Firma' : 'Sello'} actualizado.`);
      await reload();
    } catch (e2) {
      setErr(e2.message);
    }
  }

  const c = data?.certificado ?? {};
  return (
    <>
      <div className="view-head">
        <div>
          <h2>Configuración</h2>
          <p className="muted">{data?.nombre} · CUIT {data?.cuit}</p>
        </div>
      </div>
      <ErrorMsg error={error || err} />
      {msg && <p className="ok">{msg}</p>}
      <div className="grid2">
        <form className="card stack" onSubmit={guardar}>
          <h3>Firma de los certificados</h3>
          <p className="muted small">Quién firma los certificados de disposición sustentable. Los certificados ya emitidos no cambian.</p>
          <label>Responsable<input value={form.responsable} onChange={(e) => setForm({ ...form, responsable: e.target.value })} placeholder="Nombre y apellido" /></label>
          <label>Cargo<input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} placeholder="Presidente/a" /></label>
          <button type="submit">Guardar</button>
          <div className="firmas">
            {['firma', 'sello'].map((tipo) => (
              <div key={tipo} className="firma-box">
                <span className="small muted">{tipo === 'firma' ? 'Firma escaneada' : 'Sello de la cooperativa'}</span>
                {c[`${tipo}Url`] ? <img src={fileUrl(c[`${tipo}Url`])} alt={tipo} /> : <span className="muted small">Sin cargar</span>}
                <label className="button secondary sm">
                  {c[`${tipo}Url`] ? 'Cambiar' : 'Subir'} imagen
                  <input type="file" accept="image/png,image/jpeg" hidden onChange={(e) => subir(tipo, e.target.files[0])} />
                </label>
              </div>
            ))}
          </div>
          <p className="muted small">Consejo: fotografiá la firma y el sello sobre papel blanco, con buena luz, y recortá la imagen.</p>
        </form>
        <section className="card stack">
          <h3>Corrientes habilitadas</h3>
          <p className="muted small">Los materiales de corrientes no habilitadas no se pueden registrar. Para sumar una, la cooperativa tiene que tener la inscripción correspondiente.</p>
          <div className="tags">
            {Object.entries(CORRIENTES).map(([k, v]) => (
              <Tag key={k} tone={data?.habilitaciones?.corrientes?.includes(k) ? 'green' : 'gray'}>{v}</Tag>
            ))}
          </div>
        </section>
      </div>
      <Registros registros={data?.habilitaciones?.registros ?? []} onSaved={reload} />
    </>
  );
}

const VACIO = { descripcion: '', organismo: '', numero: '', vence: '' };
const SUGERENCIA = { descripcion: 'Registro municipal de depósitos de acopio', organismo: 'Municipalidad de Paraná (Ord. 9233, art. 28)', numero: '', vence: '' };

/** Inscripciones y habilitaciones: se imprimen en cada certificado (las vencidas no). */
function Registros({ registros, onSaved }) {
  const [filas, setFilas] = useState(null);
  const [err, setErr] = useState(null);
  const lista = filas ?? registros.map((r) => ({ ...VACIO, ...r, vence: r.vence ? r.vence.slice(0, 10) : '' }));
  const set = (i, k) => (e) => setFilas(lista.map((r, j) => (j === i ? { ...r, [k]: e.target.value } : r)));

  async function guardar() {
    setErr(null);
    try {
      const body = lista
        .filter((r) => r.descripcion.trim() || r.numero.trim())
        .map((r) => ({ descripcion: r.descripcion.trim(), numero: r.numero.trim(), ...(r.organismo.trim() && { organismo: r.organismo.trim() }), ...(r.vence && { vence: r.vence }) }));
      await api('/planta/organizacion/registros', { method: 'PUT', body: { registros: body } });
      setFilas(null);
      await onSaved();
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <section className="card stack">
      <h3>Inscripciones y habilitaciones</h3>
      <p className="muted small">
        Van impresas en cada certificado. En Paraná, los depósitos de acopio tienen que estar en el registro municipal (Ordenanza 9233, art. 28).
      </p>
      {lista.map((r, i) => (
        <div key={i} className="form-grid">
          <label>Registro<input value={r.descripcion} onChange={set(i, 'descripcion')} placeholder="Registro municipal de acopios" /></label>
          <label>Organismo<input value={r.organismo} onChange={set(i, 'organismo')} placeholder="Municipalidad de Paraná" /></label>
          <label>Número<input value={r.numero} onChange={set(i, 'numero')} /></label>
          <label>Vence<input type="date" value={r.vence} onChange={set(i, 'vence')} /></label>
        </div>
      ))}
      {!lista.length && <p className="muted small">Todavía no hay inscripciones cargadas.</p>}
      <ErrorMsg error={err} />
      <div className="row">
        <button type="button" className="secondary" onClick={() => setFilas([...lista, lista.length ? VACIO : SUGERENCIA])}>Agregar inscripción</button>
        {filas && <button type="button" onClick={guardar}>Guardar inscripciones</button>}
      </div>
    </section>
  );
}
