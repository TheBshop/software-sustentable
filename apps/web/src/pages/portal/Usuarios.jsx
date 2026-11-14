import { useState } from 'react';
import { api } from '../../api.js';
import { useLoad, ErrorMsg, Tag } from '../../ui.jsx';

const ROLES = { cliente_admin: 'Administrador (puede dar accesos)', cliente: 'Solo lectura' };

export default function PortalUsuarios() {
  const { data, error, reload } = useLoad('/usuarios');
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'cliente' });
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    if (form.password.length < 8) return setErr('La contraseña tiene que tener al menos 8 caracteres.');
    try {
      await api('/usuarios', { method: 'POST', body: form });
      setOk(`Usuario creado. Pasale a ${form.nombre} su email y la contraseña que elegiste.`);
      setForm({ nombre: '', email: '', password: '', rol: 'cliente' });
      await reload();
    } catch (e2) {
      setErr(e2.message);
    }
  }

  return (
    <>
      <div className="view-head"><h2>Usuarios de tu organización</h2></div>
      <ErrorMsg error={error} />
      <div className="grid2">
        <section className="card flush">
          <table>
            <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th></tr></thead>
            <tbody>
              {data?.items.map((u) => (
                <tr key={u._id}>
                  <td>{u.nombre}</td>
                  <td className="small">{u.email}</td>
                  <td>{u.rol === 'cliente_admin' ? <Tag tone="info">Administrador</Tag> : <Tag>Lectura</Tag>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <form className="card stack" onSubmit={submit}>
          <h3>Dar acceso a otra persona</h3>
          <label>Nombre<input value={form.nombre} onChange={set('nombre')} required minLength={2} /></label>
          <label>Email<input type="email" value={form.email} onChange={set('email')} required /></label>
          <label>Contraseña inicial<input type="text" value={form.password} onChange={set('password')} required minLength={8} autoComplete="new-password" /></label>
          <label>
            Rol
            <select value={form.rol} onChange={set('rol')}>
              {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <ErrorMsg error={err} />
          {ok && <p className="ok">{ok}</p>}
          <button type="submit">Crear usuario</button>
        </form>
      </div>
    </>
  );
}
