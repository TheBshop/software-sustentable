// Rutinas por puesto: tareas diarias, semanales y mensuales, con responsable y registro de quién las hizo.
import { useState } from 'react';
import { api, getUser } from '../../api.js';
import { useLoad, ErrorMsg, ConfirmButton } from '../../ui.jsx';
import Ayuda from '../../shell/Ayuda.jsx';

export default function Rutinas() {
  const { data, error, reload } = useLoad('/rutinas');
  const [nueva, setNueva] = useState({ puesto: 'recepcion', t: '', f: 'd' });
  const [err, setErr] = useState(null);
  const gestiona = ['admin', 'administracion', 'operador_planta'].includes(getUser()?.rol);
  if (error) return <ErrorMsg error={error} />;
  if (!data) return <p className="muted">Cargando…</p>;

  const marcar = (tarea, hecha) => api('/rutinas/hechas', { method: 'POST', body: { tarea, hecha } }).then(reload).catch((e) => setErr(e.message));
  const responsable = (puesto, valor) => api('/rutinas/responsables', { method: 'PUT', body: { [puesto]: valor } }).catch((e) => setErr(e.message));
  async function agregar(e) {
    e.preventDefault();
    setErr(null);
    try {
      await api('/rutinas/tareas', { method: 'POST', body: nueva });
      setNueva({ ...nueva, t: '' });
      reload();
    } catch (x) {
      setErr(x.message);
    }
  }
  const pendientes = data.tareas.filter((t) => !t.hecha).length;

  return (
    <div className="stack">
      <div className="page-h">
        <div>
          <h2>Rutinas<Ayuda>Las tareas de cada puesto. Las diarias se reinician cada día, las semanales los lunes y las mensuales el día 1. Queda registrado quién marcó cada una.</Ayuda></h2>
          <p className="muted">{pendientes ? `${pendientes} ${pendientes === 1 ? 'tarea pendiente' : 'tareas pendientes'} en el período` : 'Todo al día'}</p>
        </div>
      </div>
      <ErrorMsg error={err} />
      <div className="rut-grid">
        {Object.entries(data.puestos).map(([k, nombre]) => {
          const ts = data.tareas.filter((t) => t.puesto === k);
          const pend = ts.filter((t) => !t.hecha).length;
          return (
            <section key={k} className="card stack">
              <div className="page-h">
                <h3>{nombre}</h3>
                <span className={`tag ${pend ? 'sun' : 'green'}`}>{pend ? `${pend} ${pend === 1 ? 'pendiente' : 'pendientes'}` : 'Al día'}</span>
              </div>
              <label>
                Responsable
                <input type="text" placeholder="Nombre" defaultValue={data.responsables[k] ?? ''} disabled={!gestiona} onBlur={(e) => e.target.value !== (data.responsables[k] ?? '') && responsable(k, e.target.value)} />
              </label>
              <ul className="rut-lista">
                {ts.map((t) => (
                  <li key={t.id}>
                    <label className="check">
                      <input type="checkbox" checked={Boolean(t.hecha)} onChange={(e) => marcar(t.id, e.target.checked)} /> {t.t}
                    </label>
                    <span className="rut-meta">
                      <span className="tag gray">{data.frecuencias[t.f]}</span>
                      {t.dias && (
                        <span className="rut-dias" aria-label="Últimos 7 días">
                          {t.dias.map((si, i) => <i key={data.ultimosDias[i]} className={si ? 'si' : ''} title={data.ultimosDias[i]} />)}
                        </span>
                      )}
                      {!t.base && gestiona && <ConfirmButton onConfirm={() => api(`/rutinas/tareas/${t.id}`, { method: 'DELETE' }).then(reload)}>Quitar</ConfirmButton>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      {gestiona && (
        <form className="card stack" onSubmit={agregar}>
          <h3>Agregar tarea</h3>
          <div className="form-grid">
            <label>
              Puesto
              <select value={nueva.puesto} onChange={(e) => setNueva({ ...nueva, puesto: e.target.value })}>
                {Object.entries(data.puestos).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
              </select>
            </label>
            <label>Tarea<input type="text" required minLength={3} value={nueva.t} onChange={(e) => setNueva({ ...nueva, t: e.target.value })} /></label>
            <label>
              Frecuencia
              <select value={nueva.f} onChange={(e) => setNueva({ ...nueva, f: e.target.value })}>
                {Object.entries(data.frecuencias).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
              </select>
            </label>
          </div>
          <div className="row"><button type="submit" className="secondary">Agregar</button></div>
        </form>
      )}
    </div>
  );
}
