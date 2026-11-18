// Shell del portal del generador: usa la misma identidad B2B que el panel de la cooperativa.
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { getUser, logout } from '../../api.js';
import { Icono } from '../../shell/Shell.jsx';

const LINKS = [
  { to: '/portal', label: 'Impacto', end: true, icono: 'inicio' },
  { to: '/portal/pedidos', label: 'Pedir un retiro', icono: 'operacion' },
  { to: '/portal/retiros', label: 'Retiros', icono: 'operacion' },
  { to: '/portal/certificados', label: 'Certificados', icono: 'cumplimiento' },
  { to: '/portal/facturas', label: 'Facturas', icono: 'comercial' },
  { to: '/portal/informe', label: 'Informe anual', icono: 'resultados' },
  { to: '/portal/clasificar', label: 'Clasificar residuos', icono: 'cumplimiento' },
];

export default function PortalShell() {
  const user = getUser();
  const { pathname } = useLocation();
  const activa = LINKS.find((l) => (l.end ? pathname === l.to : pathname.startsWith(l.to)));
  const iniciales = (user?.organizacion?.nombre ?? '').split(/\s+/).filter((p) => /^[A-ZÁÉÍÓÚÑ]/.test(p)).slice(0, 2).map((p) => p[0]).join('') || user?.organizacion?.nombre?.[0] || '?';
  return (
    <div className="shell">
      <aside className="side" aria-label="Menú del portal">
        <div className="side-head">
          <Link className="logo" to="/portal" title="Portal">
            <span className="logo-mark"><Icono n="logo" /></span>
            <span className="nav-txt">Portal</span>
          </Link>
        </div>
        <nav>
          <span className="nav-sec">{user?.organizacion?.tipo === 'municipio' ? 'Municipio' : 'Empresa'}</span>
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}>
              <Icono n={l.icono} />
              <span className="nav-txt">{l.label}</span>
            </NavLink>
          ))}
          {user?.rol === 'cliente_admin' && (
            <NavLink to="/portal/usuarios">
              <Icono n="cumplimiento" />
              <span className="nav-txt">Usuarios</span>
            </NavLink>
          )}
        </nav>
        <button type="button" className="side-salir" onClick={logout} title="Salir">
          <Icono n="salir" />
          <span className="nav-txt">Salir</span>
        </button>
      </aside>
      <div className="contenido">
        <header className="appbar">
          <div className="appbar-in">
            <div className="migas">
              <b>{activa?.label ?? 'Portal'}</b>
            </div>
            <span className="org">
              <span className="org-av" aria-hidden="true">{iniciales.toUpperCase()}</span>
              <span className="org-t">
                <b>{user?.organizacion?.nombre}</b>
                <span>{user?.nombre}</span>
              </span>
            </span>
          </div>
        </header>
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
