// Administración de la plataforma: alta de organizaciones y sus usuarios, reset de contraseñas,
// baja de organizaciones. Lo usan los usuarios `superadmin` de la organización "Plataforma".
import { useMemo, useState } from 'react';
import { api, fmtFecha, getUser, logout } from '../../api.js';
import { useLoad, ErrorMsg, ConfirmButton } from '../../ui.jsx';
import Ayuda from '../../shell/Ayuda.jsx';
import { Icono } from '../../shell/Shell.jsx';

const TIPOS = { cooperativa: 'Cooperativa', recicladora: 'Empresa recicladora', municipio: 'Municipio' };
const PROVINCIAS = [
  ['buenos_aires', 'Buenos Aires'], ['caba', 'CABA'], ['catamarca', 'Catamarca'], ['chaco', 'Chaco'], ['chubut', 'Chubut'],
  ['cordoba', 'Córdoba'], ['corrientes', 'Corrientes'], ['entre_rios', 'Entre Ríos'], ['formosa', 'Formosa'], ['jujuy', 'Jujuy'],
  ['la_pampa', 'La Pampa'], ['la_rioja', 'La Rioja'], ['mendoza', 'Mendoza'], ['misiones', 'Misiones'], ['neuquen', 'Neuquén'],
  ['rio_negro', 'Río Negro'], ['salta', 'Salta'], ['san_juan', 'San Juan'], ['san_luis', 'San Luis'], ['santa_cruz', 'Santa Cruz'],
  ['santa_fe', 'Santa Fe'], ['santiago_estero', 'Santiago del Estero'], ['tierra_del_fuego', 'Tierra del Fuego'], ['tucuman', 'Tucumán'],
];
const ROLES_OPERADOR = ['admin', 'administracion', 'operador_planta', 'chofer'];

function NuevaOrg({ onListo }) {
  const [f, setF] = useState({ tipo: 'cooperativa', nombre: '', cuit: '', provincia: '', email: '', nombreAdmin: '' });
  const [err, setErr] = useState(null);
  const [password, setPassword] = useState(null);
  const [cargando, setCargando] = useState(false);

  async function crear(e) {
    e.preventDefault();
    setErr(null);
    setPassword(null);
    setCargando(true);
    try {
      const r = await api('/admin/organizaciones', {
        method: 'POST',
        body: {
          tipo: f.tipo,
          nombre: f.nombre,
          cuit: f.cuit || undefined,
          provincia: f.provincia || undefined,
          admin: { email: f.email, nombre: f.nombreAdmin },
        },
      });
      setPassword(r.admin.password);
      setF({ tipo: f.tipo, nombre: '', cuit: '', provincia: '', email: '', nombreAdmin: '' });
      onListo();
    } catch (x) {
      setErr(x.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <form className="card stack" onSubmit={crear}>
      <h3>Nueva organización</h3>
      <div className="form-grid">
        <label>
          Tipo
          <select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
            {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label>Nombre<input type="text" required minLength={2} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></label>
        <label>CUIT<input type="text" placeholder="30-12345678-9" value={f.cuit} onChange={(e) => setF({ ...f, cuit: e.target.value })} /></label>
        <label>
          Provincia
          <select value={f.provincia} onChange={(e) => setF({ ...f, provincia: e.target.value })}>
            <option value="">—</option>
            {PROVINCIAS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label>Email del admin<input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        <label>Nombre del admin<input type="text" required minLength={2} value={f.nombreAdmin} onChange={(e) => setF({ ...f, nombreAdmin: e.target.value })} /></label>
      </div>
      {err && <p className="error" role="alert">{err}</p>}
      {password && (
        <div className="aviso info">
          <span>Organización creada. Contraseña del admin: <code className="secreto">{password}</code></span>
          <button type="button" className="secondary sm" onClick={() => navigator.clipboard?.writeText(password)}>Copiar</button>
        </div>
      )}
      <div className="row"><button type="submit" disabled={cargando}>{cargando ? 'Creando…' : 'Crear organización'}</button></div>
    </form>
  );
}

function Usuarios({ orgId, orgRol, onCambio }) {
  const { data, reload } = useLoad(`/admin/organizaciones/${orgId}/usuarios`);
  const [nuevo, setNuevo] = useState({ email: '', nombre: '', rol: orgRol === 'operador' ? 'operador_planta' : 'cliente' });
  const [err, setErr] = useState(null);
  const [recien, setRecien] = useState(null);
  const roles = orgRol === 'operador' ? ROLES_OPERADOR : ['cliente_admin', 'cliente'];

  async function crear(e) {
    e.preventDefault();
    setErr(null);
    try {
      const r = await api(`/admin/organizaciones/${orgId}/usuarios`, { method: 'POST', body: nuevo });
      setRecien(r);
      setNuevo({ ...nuevo, email: '', nombre: '' });
      reload();
      onCambio?.();
    } catch (x) {
      setErr(x.message);
    }
  }
  async function resetear(id) {
    const r = await api(`/admin/usuarios/${id}/password`, { method: 'POST' });
    setRecien(r);
  }
  async function toggle(id, activo) {
    await api(`/admin/usuarios/${id}`, { method: 'PATCH', body: { activo } });
    reload();
  }

  if (!data) return <p className="muted">Cargando…</p>;
  return (
    <div className="stack">
      {recien?.password && (
        <div className="aviso info">
          <span>Contraseña generada para <b>{recien.email}</b>: <code className="secreto">{recien.password}</code></span>
          <button type="button" className="secondary sm" onClick={() => navigator.clipboard?.writeText(recien.password)}>Copiar</button>
        </div>
      )}
      <div className="card flush table-wrap">
        <table>
          <thead><tr><th>Usuario</th><th>Email</th><th>Rol</th><th>Estado</th><th /></tr></thead>
          <tbody>
            {data.items.map((u) => (
              <tr key={u._id}>
                <td>{u.nombre}</td>
                <td className="small">{u.email}</td>
                <td><span className="tag gray">{u.rol}</span></td>
                <td>{u.activo ? <span className="tag green">Activo</span> : <span className="tag red">Inactivo</span>}</td>
                <td className="actions">
                  <button type="button" className="link" onClick={() => resetear(u._id)}>Reset contraseña</button>
                  <button type="button" className="link" onClick={() => toggle(u._id, !u.activo)}>{u.activo ? 'Desactivar' : 'Activar'}</button>
                </td>
              </tr>
            ))}
            {!data.items.length && <tr><td colSpan={5} className="muted">Sin usuarios.</td></tr>}
          </tbody>
        </table>
      </div>
      <form className="form-grid" onSubmit={crear}>
        <label>Email<input type="email" required value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} /></label>
        <label>Nombre<input type="text" required minLength={2} value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} /></label>
        <label>
          Rol
          <select value={nuevo.rol} onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value })}>
            {roles.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <div className="row" style={{ alignSelf: 'end' }}><button type="submit" className="secondary">Agregar usuario</button></div>
      </form>
      {err && <p className="error" role="alert">{err}</p>}
    </div>
  );
}

function Fila({ o, onCambio }) {
  const [abierta, setAbierta] = useState(false);
  async function toggleActivo() {
    await api(`/admin/organizaciones/${o.id}`, { method: 'PATCH', body: { activo: !o.activo } });
    onCambio();
  }
  return (
    <>
      <tr>
        <td><b>{o.nombre}</b>{o.jurisdiccion?.provincia && <div className="small muted">{o.jurisdiccion.ciudad ?? o.jurisdiccion.provincia}</div>}</td>
        <td><span className="tag gray">{TIPOS[o.tipo] ?? o.tipo}</span></td>
        <td className="num small">{o.cuit ?? '—'}</td>
        <td className="r num">{o.usuarios}</td>
        <td>{o.activo ? <span className="tag green">Activa</span> : <span className="tag red">Inactiva</span>}</td>
        <td className="small muted">{fmtFecha(o.creada)}</td>
        <td className="actions">
          <button type="button" className="link" onClick={() => setAbierta(!abierta)}>{abierta ? 'Cerrar' : 'Usuarios'}</button>
          <ConfirmButton onConfirm={toggleActivo}>{o.activo ? 'Desactivar' : 'Activar'}</ConfirmButton>
        </td>
      </tr>
      {abierta && (
        <tr><td colSpan={7} style={{ background: 'var(--gris-claro)' }}>
          <Usuarios orgId={o.id} orgRol={o.rol} onCambio={onCambio} />
        </td></tr>
      )}
    </>
  );
}

export default function Plataforma() {
  const user = getUser();
  const [filtro, setFiltro] = useState('');
  const { data, error, reload } = useLoad('/admin/organizaciones');
  const items = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    const items = data?.items ?? [];
    return q ? items.filter((o) => o.nombre.toLowerCase().includes(q) || (o.cuit ?? '').includes(q)) : items;
  }, [data, filtro]);
  const iniciales = (user?.nombre ?? 'P').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="shell">
      <aside className="side" aria-label="Administración">
        <div className="side-head">
          <span className="logo"><span className="logo-mark"><Icono n="logo" /></span><span className="nav-txt">Plataforma</span></span>
        </div>
        <nav>
          <span className="nav-sec">Administración</span>
          <a className="active"><Icono n="comercial" /><span className="nav-txt">Organizaciones</span></a>
        </nav>
        <button type="button" className="side-salir" onClick={logout}><Icono n="salir" /><span className="nav-txt">Salir</span></button>
      </aside>
      <div className="contenido">
        <header className="appbar">
          <div className="appbar-in">
            <div className="migas"><b>Organizaciones</b></div>
            <span className="org">
              <span className="org-av">{iniciales}</span>
              <span className="org-t"><b>Plataforma</b><span>{user?.nombre} · superadmin</span></span>
            </span>
          </div>
        </header>
        <main>
          <div className="stack">
            <ErrorMsg error={error} />
            <div className="page-h">
              <div>
                <h2>Organizaciones<Ayuda>Alta y baja de cooperativas, recicladoras y municipios operadores; usuarios y contraseñas.</Ayuda></h2>
                <p className="muted">{data?.items.length ?? 0} organizaciones en la plataforma.</p>
              </div>
              <label className="row">Buscar<input type="search" placeholder="Nombre o CUIT" value={filtro} onChange={(e) => setFiltro(e.target.value)} /></label>
            </div>
            <NuevaOrg onListo={reload} />
            <div className="card flush table-wrap">
              <table>
                <thead><tr><th>Organización</th><th>Tipo</th><th>CUIT</th><th className="r">Usuarios</th><th>Estado</th><th>Creada</th><th /></tr></thead>
                <tbody>
                  {items.map((o) => <Fila key={o.id} o={o} onCambio={reload} />)}
                  {data && !items.length && <tr><td colSpan={7} className="muted">Sin organizaciones.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
