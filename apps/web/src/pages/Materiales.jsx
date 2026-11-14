import { useState } from 'react';
import { api, fmtPeso } from '../api.js';
import { useLoad, ErrorMsg, ConfirmButton } from '../ui.jsx';
import { FRACCIONES, CORRIENTES, SUBTIPOS_REGU, FraccionChip } from '../residuos.jsx';

export const CATEGORIAS = {
  papel_carton: 'Papel y cartón',
  plasticos: 'Plásticos',
  vidrio: 'Vidrio',
  metales: 'Metales',
  electronicos: 'Electrónicos',
  otros: 'Otros',
};
const VACIO = { codigo: '', nombre: '', categoria: 'papel_carton', corriente: 'rsu', fraccion: '', subtipoRegu: '', factorCo2: '', tarifaRetiroKg: '', precioVentaKg: '' };

export default function Materiales() {
  const { data, error, reload } = useLoad('/materiales?limit=200');
  const org = useLoad('/planta/organizacion');
  const habilitadas = org.data?.habilitaciones?.corrientes ?? ['rsu'];
  const [form, setForm] = useState(null); // null = cerrado
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function save(e) {
    e.preventDefault();
    setErr(null);
    const body = {
      codigo: form.codigo.trim().toUpperCase(),
      nombre: form.nombre.trim(),
      categoria: form.categoria,
      corriente: form.corriente,
      ...(form.corriente === 'rsu' && form.fraccion && { fraccion: form.fraccion }),
      ...(form.corriente === 'regu' && { subtipoRegu: form.subtipoRegu || undefined }),
      factorCo2: Number(form.factorCo2) || 0,
      tarifaRetiroKg: Number(form.tarifaRetiroKg) || 0,
      precioVentaKg: Number(form.precioVentaKg) || 0,
    };
    if (body.codigo.length < 2) return setErr('El código tiene que tener al menos 2 letras.');
    if (body.nombre.length < 2) return setErr('Completá el nombre.');
    try {
      await api(form._id ? `/materiales/${form._id}` : '/materiales', { method: form._id ? 'PATCH' : 'POST', body });
      setForm(null);
      await reload();
    } catch (e2) {
      setErr(e2.message);
    }
  }

  const edit = (m) =>
    setForm({ _id: m._id, codigo: m.codigo, nombre: m.nombre, categoria: m.categoria, corriente: m.corriente ?? 'rsu', fraccion: m.fraccion ?? '', subtipoRegu: m.subtipoRegu ?? '', factorCo2: String(m.factorCo2), tarifaRetiroKg: String(m.tarifaRetiroKg), precioVentaKg: String(m.precioVentaKg) });

  return (
    <>
      <div className="view-head">
        <div>
          <h2>Materiales</h2>
          <p className="muted">Tarifas por defecto y factor de CO₂ que usan los certificados. Cada cliente puede tener su propio precio por kg.</p>
        </div>
        {!form && <button type="button" onClick={() => { setErr(null); setForm(VACIO); }}>Nuevo material</button>}
      </div>

      {form && (
        <form className="card stack" onSubmit={save}>
          <h3>{form._id ? `Editar ${form.nombre}` : 'Nuevo material'}</h3>
          <div className="form-grid">
            <label>Código<input value={form.codigo} onChange={set('codigo')} placeholder="PET" maxLength={20} required autoFocus /></label>
            <label>Nombre<input value={form.nombre} onChange={set('nombre')} placeholder="Botellas PET" required /></label>
            <label>
              Categoría
              <select value={form.categoria} onChange={set('categoria')}>
                {Object.entries(CATEGORIAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label>
              Corriente
              <select value={form.corriente} onChange={set('corriente')}>
                {Object.entries(CORRIENTES).map(([k, v]) => (
                  <option key={k} value={k} disabled={!habilitadas.includes(k)}>{v}{habilitadas.includes(k) ? '' : ' (no habilitada)'}</option>
                ))}
              </select>
            </label>
            {form.corriente === 'rsu' && (
              <label>
                Fracción (Decreto 779/22)
                <select value={form.fraccion} onChange={set('fraccion')}>
                  <option value="">Según la categoría</option>
                  {Object.entries(FRACCIONES).map(([k, v]) => <option key={k} value={k}>{v.nombre} ({v.color})</option>)}
                </select>
              </label>
            )}
            {form.corriente === 'regu' && (
              <label>
                Tipo de residuo especial
                <select value={form.subtipoRegu} onChange={set('subtipoRegu')} required>
                  <option value="">Elegí…</option>
                  {Object.entries(SUBTIPOS_REGU).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
            )}
            <label>Factor CO₂ (kg por kg)<input type="number" min="0" step="any" value={form.factorCo2} onChange={set('factorCo2')} /></label>
            <label>Tarifa de retiro ($/kg)<input type="number" min="0" step="any" value={form.tarifaRetiroKg} onChange={set('tarifaRetiroKg')} /></label>
            <label>Precio de venta ($/kg)<input type="number" min="0" step="any" value={form.precioVentaKg} onChange={set('precioVentaKg')} /></label>
          </div>
          {form._id && <p className="muted small">Cambiar el factor de CO₂ no modifica los certificados ya emitidos.</p>}
          <ErrorMsg error={err} />
          <div className="row"><button type="submit">Guardar material</button><button type="button" className="secondary" onClick={() => setForm(null)}>Cancelar</button></div>
        </form>
      )}

      <ErrorMsg error={error} />
      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Código</th><th>Nombre</th><th>Clasificación</th><th className="r">CO₂ (kg/kg)</th><th className="r">Retiro $/kg</th><th className="r">Venta $/kg</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {data?.items.map((m) => (
                <tr key={m._id}>
                  <td className="mono">{m.codigo}</td>
                  <td>{m.nombre}</td>
                  <td>
                    <FraccionChip fraccion={m.fraccion} corriente={m.corriente} />
                    <div className="muted small">{m.corriente === 'regu' ? SUBTIPOS_REGU[m.subtipoRegu] : CATEGORIAS[m.categoria]}{m.valorizable === false && ' · no valorizable'}</div>
                  </td>
                  <td className="r num">{m.factorCo2.toLocaleString('es-AR')}</td>
                  <td className="r num">{m.tarifaRetiroKg ? fmtPeso(m.tarifaRetiroKg) : <span className="muted">sin cargo</span>}</td>
                  <td className="r num">{fmtPeso(m.precioVentaKg)}</td>
                  <td>
                    <div className="actions">
                      <button type="button" className="link" onClick={() => edit(m)}>Editar</button>
                      <ConfirmButton onConfirm={() => api(`/materiales/${m._id}`, { method: 'DELETE' }).then(reload)} confirmLabel="Sí, dar de baja">Baja</ConfirmButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="muted small">⚠ Los factores de CO₂ cargados son de ejemplo. Antes de entregar certificados reales hay que definir la fuente.</p>
    </>
  );
}
