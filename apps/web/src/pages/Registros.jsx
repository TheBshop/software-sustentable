// Registros de la operación según el perfil. Los que tienen pantalla propia (ingresos, ventas,
// personal, seguridad) llevan a esa pantalla; el resto se carga acá.
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, fmtFecha, isoDate, getUser } from '../api.js';
import { useLoad, ErrorMsg, ConfirmButton } from '../ui.jsx';
import Ayuda from '../shell/Ayuda.jsx';

const PANTALLA_PROPIA = {
  cooperativa: { ingresos: '/operacion/planta', separado: '/operacion/planta', rechazo: '/operacion/planta', ventas: '/comercial/ventas', personal: '/operacion/productividad', paradas: '/operacion/productividad', accidentes: '/operacion/seguridad', epp: '/operacion/seguridad', capacitaciones: '/operacion/seguridad' },
  empresa: { ventas: '/comercial/ventas', personal: '/operacion/productividad', paradas: '/operacion/productividad', accidentes: '/operacion/seguridad', epp: '/operacion/seguridad', capacitaciones: '/operacion/seguridad' },
  municipio: {},
};
const ESCRIBEN = ['admin', 'administracion', 'operador_planta'];

const vacio = (def) => Object.fromEntries(def.campos.filter((c) => c.k !== 'fecha').map((c) => [c.k, '']));

function Formulario({ def, mes, editando, onGuardado, onCancelar }) {
  const inicial = editando
    ? { fecha: editando.fecha ? isoDate(editando.fecha) : '', mes: editando.fecha ? isoDate(editando.fecha).slice(0, 7) : mes, datos: { ...vacio(def), ...editando.datos, ...(editando.datos.fecha && { fecha: undefined }) } }
    : { fecha: isoDate(), mes, datos: vacio(def) };
  const [f, setF] = useState(inicial);
  const [error, setError] = useState(null);
  const conFecha = def.campos.some((c) => c.k === 'fecha');
  const fechaPadron = editando?.datos?.fecha ? isoDate(editando.datos.fecha) : '';
  const [fechaSinMes, setFechaSinMes] = useState(fechaPadron);

  async function enviar(e) {
    e.preventDefault();
    setError(null);
    const body = def.mensual ? { mes: f.mes, datos: f.datos } : def.sinMes ? { ...(conFecha && fechaSinMes && { fecha: fechaSinMes }), datos: f.datos } : { fecha: f.fecha, datos: f.datos };
    try {
      await api(`/registros/${def.id}${editando ? `/${editando._id}` : ''}`, { method: editando ? 'PATCH' : 'POST', body });
      setF({ ...inicial, datos: vacio(def), fecha: f.fecha });
      onGuardado();
    } catch (err) {
      setError(err.message);
    }
  }

  const set = (k, v) => setF({ ...f, datos: { ...f.datos, [k]: v } });
  return (
    <form className="card stack" onSubmit={enviar}>
      <h3>{editando ? 'Corregir fila' : 'Nueva fila'}</h3>
      <div className="form-grid">
        {def.mensual && (
          <label>
            Mes
            <input type="month" value={f.mes} onChange={(e) => setF({ ...f, mes: e.target.value })} required />
          </label>
        )}
        {conFecha && !def.sinMes && (
          <label>
            Fecha
            <input type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} required />
          </label>
        )}
        {def.campos
          .filter((c) => c.k !== 'fecha')
          .map((c) => (
            <label key={c.k}>
              {c.label}
              {c.tipo === 'sel' ? (
                <select value={f.datos[c.k] ?? ''} onChange={(e) => set(c.k, e.target.value)} required={c.k !== 'pesaje'}>
                  <option value="">Elegí…</option>
                  {c.op.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input type={c.tipo === 'num' ? 'number' : 'text'} min={c.tipo === 'num' ? 0 : undefined} step="any" value={f.datos[c.k] ?? ''} onChange={(e) => set(c.k, e.target.value)} required={c.tipo === 'num'} />
              )}
            </label>
          ))}
        {conFecha && def.sinMes && (
          <label>
            Fecha
            <input type="date" value={fechaSinMes} onChange={(e) => setFechaSinMes(e.target.value)} />
          </label>
        )}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row">
        <button type="submit">{editando ? 'Guardar corrección' : 'Agregar'}</button>
        {editando && <button type="button" className="secondary" onClick={onCancelar}>Cancelar</button>}
      </div>
    </form>
  );
}

function valor(c, fila) {
  if (c.k === 'fecha') return fmtFecha(fila.datos.fecha ?? fila.fecha);
  const v = fila.datos[c.k];
  if (v === undefined || v === '') return '—';
  return c.tipo === 'num' ? Number(v).toLocaleString('es-AR') : v;
}

function Registro({ def, mes, onCambio }) {
  const { data, error, reload } = useLoad(`/registros/${def.id}?mes=${mes}`);
  const [editando, setEditando] = useState(null);
  const puede = ESCRIBEN.includes(getUser()?.rol);
  const columnas = def.mensual ? [{ k: 'mes', label: 'Mes' }, ...def.campos] : def.campos;

  async function borrar(id) {
    await api(`/registros/${def.id}/${id}`, { method: 'DELETE' });
    reload();
    onCambio();
  }

  return (
    <div className="stack">
      <div className="page-h">
        <h2>
          {def.nombre}
          <Ayuda>{def.ayuda}</Ayuda>
        </h2>
        {def.sinMes && <span className="tag gray">Padrón: no depende del mes</span>}
      </div>
      {puede && <Formulario key={`${def.id}-${editando?._id ?? 'nueva'}`} def={def} mes={mes} editando={editando} onGuardado={() => { setEditando(null); reload(); onCambio(); }} onCancelar={() => setEditando(null)} />}
      <ErrorMsg error={error} />
      <div className="card flush table-wrap">
        <table>
          <thead>
            <tr>
              {columnas.map((c) => <th key={c.k} className={c.tipo === 'num' ? 'r' : undefined}>{c.label}</th>)}
              {puede && <th />}
            </tr>
          </thead>
          <tbody>
            {data?.items.map((fila) => (
              <tr key={fila._id}>
                {columnas.map((c) => (
                  <td key={c.k} className={c.tipo === 'num' ? 'r num' : undefined}>
                    {c.k === 'mes' ? new Date(fila.fecha).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }) : valor(c, fila)}
                  </td>
                ))}
                {puede && (
                  <td className="actions">
                    <button type="button" className="link" onClick={() => setEditando(fila)}>Corregir</button>
                    <ConfirmButton onConfirm={() => borrar(fila._id)}>Borrar</ConfirmButton>
                  </td>
                )}
              </tr>
            ))}
            {data && !data.items.length && (
              <tr>
                <td colSpan={columnas.length + 1} className="muted">{def.sinMes ? 'Todavía no hay filas.' : 'No hay filas en este mes.'}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Registros() {
  const [params, setParams] = useSearchParams();
  const [mes, setMes] = useState(isoDate().slice(0, 7));
  const { data, error, reload } = useLoad(`/registros?mes=${mes}`);
  if (error) return <ErrorMsg error={error} />;
  if (!data) return <p className="muted">Cargando…</p>;
  const propias = PANTALLA_PROPIA[data.perfil] ?? {};
  const aca = data.definiciones.filter((d) => !propias[d.id]);
  const activo = aca.find((d) => d.id === params.get('r')) ?? aca[0];

  return (
    <div className="reg-layout">
      <aside className="stack">
        <label>
          Mes
          <input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} />
        </label>
        <nav className="reg-lista" aria-label="Registros">
          {data.definiciones.map((d) =>
            propias[d.id] ? (
              <Link key={d.id} className="reg-item" to={propias[d.id]}>
                <span>{d.nombre}</span>
                <span className="ext">abrir →</span>
              </Link>
            ) : (
              <button key={d.id} type="button" className={`reg-item ${d.id === activo?.id ? 'active' : ''}`} onClick={() => setParams({ r: d.id })} aria-current={d.id === activo?.id ? 'true' : undefined}>
                <span>{d.nombre}</span>
                <span className={`cnt ${d.filasMes ? 'ok' : ''}`}>{d.filasMes}</span>
              </button>
            ),
          )}
        </nav>
      </aside>
      {activo && <Registro key={`${activo.id}-${mes}`} def={activo} mes={mes} onCambio={reload} />}
    </div>
  );
}
