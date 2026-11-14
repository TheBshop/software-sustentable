import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

/** Carga datos de la API y expone { data, error, loading, reload }. */
export function useLoad(path) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const reload = useCallback(() => {
    if (!path) return Promise.resolve();
    setState((s) => ({ ...s, loading: true }));
    return api(path)
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((e) => setState((s) => ({ ...s, error: e.message, loading: false })));
  }, [path]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { ...state, reload };
}

export function Tag({ tone = 'gray', children }) {
  return <span className={`tag ${tone}`}>{children}</span>;
}

export function ErrorMsg({ error }) {
  return error ? <p className="error" role="alert">{error}</p> : null;
}

/**
 * Botón con confirmación en dos pasos (en vez de window.confirm):
 * primer click muestra "¿Seguro?", el segundo ejecuta.
 */
export function ConfirmButton({ onConfirm, children, confirmLabel = 'Confirmar', className = 'link danger' }) {
  const [armed, setArmed] = useState(false);
  if (!armed) return <button type="button" className={className} onClick={() => setArmed(true)}>{children}</button>;
  return (
    <span className="confirm">
      <button type="button" className="link danger" onClick={() => { setArmed(false); onConfirm(); }}>{confirmLabel}</button>
      <button type="button" className="link" onClick={() => setArmed(false)}>No</button>
    </span>
  );
}

/**
 * Editor de renglones { material, pesoKg | cantidad+unidad, precioKg? } para ingresos y ventas.
 * - `conUnidades`: además de kg permite cargar fardos, bolsones, camiones… (peso sin balanza),
 *   con el peso estándar configurado en cada material.
 * - `conPrecio`: columna de precio; muestra el rango de mercado y avisa si se vende por debajo.
 */
export function ItemsEditor({ materiales, items, onChange, conPrecio = false, conUnidades = false }) {
  const set = (i, patch) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const add = () => onChange([...items, { material: '', pesoKg: '', unidad: 'kg', ...(conPrecio && { precioKg: '' }) }]);
  const mat = (id) => materiales.find((x) => x._id === id);
  return (
    <div className="items-editor">
      {items.map((it, i) => {
        const m = mat(it.material);
        const unidades = conUnidades ? m?.unidades ?? [] : [];
        const unidad = unidades.find((u) => u.nombre === it.unidad);
        const ref = conPrecio ? m?.precioReferencia : null;
        const debajo = ref?.minKg != null && it.precioKg !== '' && Number(it.precioKg) < ref.minKg;
        return (
          <div key={i} className="item-block">
            <div className={`item-row ${unidades.length ? 'con-unidad' : ''}`}>
              <select
                aria-label="Material"
                value={it.material}
                onChange={(e) => {
                  const nm = mat(e.target.value);
                  set(i, { material: e.target.value, unidad: 'kg', ...(conPrecio && nm && !it.precioKg && { precioKg: nm.precioVentaKg }) });
                }}
              >
                <option value="">Material…</option>
                {materiales.map((x) => <option key={x._id} value={x._id}>{x.nombre}</option>)}
              </select>
              <input aria-label={unidad ? `Cantidad de ${unidad.nombre}s` : 'Kg'} type="number" min="0" step="any" placeholder={unidad ? 'cantidad' : 'kg'} value={it.pesoKg} onChange={(e) => set(i, { pesoKg: e.target.value })} />
              {unidades.length > 0 && (
                <select aria-label="Unidad" value={it.unidad ?? 'kg'} onChange={(e) => set(i, { unidad: e.target.value })}>
                  <option value="kg">kg</option>
                  {unidades.map((u) => <option key={u.nombre} value={u.nombre}>{u.nombre} (~{u.kg} kg)</option>)}
                </select>
              )}
              {conPrecio && <input aria-label="Precio por kg" type="number" min="0" step="any" placeholder="$/kg" value={it.precioKg} onChange={(e) => set(i, { precioKg: e.target.value })} />}
              <button type="button" className="link danger" aria-label="Quitar renglón" onClick={() => onChange(items.filter((_, j) => j !== i))} disabled={items.length === 1}>✕</button>
            </div>
            {unidad && Number(it.pesoKg) > 0 && <p className="muted small">≈ {(Number(it.pesoKg) * unidad.kg).toLocaleString('es-AR')} kg estimados</p>}
            {ref?.minKg != null && (
              <p className={`small ${debajo ? 'error' : 'muted'}`}>
                {debajo ? '⚠ Por debajo del precio de mercado. ' : ''}Referencia: ${ref.minKg.toLocaleString('es-AR')} a ${ref.maxKg?.toLocaleString('es-AR')} por kg
              </p>
            )}
          </div>
        );
      })}
      <button type="button" className="link" onClick={add}>+ Agregar material</button>
    </div>
  );
}

/** Convierte los renglones del editor al formato de la API, validando. */
export function itemsToApi(items, conPrecio = false) {
  const out = items.filter((it) => it.material || it.pesoKg);
  if (!out.length) throw new Error('Cargá al menos un material.');
  return out.map((it) => {
    if (!it.material) throw new Error('Elegí el material en todos los renglones.');
    const valor = Number(it.pesoKg);
    if (!(valor > 0)) throw new Error('La cantidad tiene que ser mayor a cero.');
    // Sin balanza: se manda la cantidad y la unidad; el servidor calcula los kg
    const peso = it.unidad && it.unidad !== 'kg' ? { cantidad: valor, unidad: it.unidad } : { pesoKg: valor };
    if (!conPrecio) return { material: it.material, ...peso };
    const precioKg = Number(it.precioKg);
    if (!(precioKg >= 0) || it.precioKg === '') throw new Error('Completá el precio por kg.');
    return { material: it.material, pesoKg: valor, precioKg };
  });
}
