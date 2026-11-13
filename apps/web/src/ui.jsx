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
 * Editor de renglones { material, pesoKg, precioKg? } para ingresos a planta y ventas.
 * `conPrecio` agrega la columna de precio, que arranca con el precio de venta del material.
 */
export function ItemsEditor({ materiales, items, onChange, conPrecio = false }) {
  const set = (i, patch) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const add = () => onChange([...items, { material: '', pesoKg: '', ...(conPrecio && { precioKg: '' }) }]);
  return (
    <div className="items-editor">
      {items.map((it, i) => (
        <div className="item-row" key={i}>
          <select
            aria-label="Material"
            value={it.material}
            onChange={(e) => {
              const m = materiales.find((x) => x._id === e.target.value);
              set(i, { material: e.target.value, ...(conPrecio && m && !it.precioKg && { precioKg: m.precioVentaKg }) });
            }}
          >
            <option value="">Material…</option>
            {materiales.map((m) => <option key={m._id} value={m._id}>{m.nombre}</option>)}
          </select>
          <input aria-label="Kg" type="number" min="0" step="any" placeholder="kg" value={it.pesoKg} onChange={(e) => set(i, { pesoKg: e.target.value })} />
          {conPrecio && <input aria-label="Precio por kg" type="number" min="0" step="any" placeholder="$/kg" value={it.precioKg} onChange={(e) => set(i, { precioKg: e.target.value })} />}
          <button type="button" className="link danger" aria-label="Quitar renglón" onClick={() => onChange(items.filter((_, j) => j !== i))} disabled={items.length === 1}>✕</button>
        </div>
      ))}
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
    const pesoKg = Number(it.pesoKg);
    if (!(pesoKg > 0)) throw new Error('Los kg tienen que ser mayores a cero.');
    if (!conPrecio) return { material: it.material, pesoKg };
    const precioKg = Number(it.precioKg);
    if (!(precioKg >= 0) || it.precioKg === '') throw new Error('Completá el precio por kg.');
    return { material: it.material, pesoKg, precioKg };
  });
}
