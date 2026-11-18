import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { api, getUser, logout } from '../api.js';
import { PERFILES, perfilDe, seccionesPara, ubicar } from './secciones.js';

const PATHS = {
  inicio: ['M3 10.5 12 3l9 7.5', 'M5 9.5V21h14V9.5', 'M9.5 21v-6h5v6'],
  operacion: ['M3 12h4l3-8 4 16 3-8h4'],
  comercial: ['M3 7h18v13H3z', 'M8 7V4h8v3', 'M3 12h18'],
  resultados: ['M4 20V10', 'M10 20V4', 'M16 20v-7', 'M22 20H2'],
  cumplimiento: ['M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z', 'm9 12 2 2 4-4'],
  colapsar: ['M15 6l-6 6 6 6'],
  expandir: ['M9 6l6 6-6 6'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  salir: ['M15 4h4v16h-4', 'M10 8l-4 4 4 4', 'M6 12h10'],
  logo: ['M7 19H4.8a1.8 1.8 0 0 1-1.6-2.7l1.2-2', 'M11 19h8.2a1.8 1.8 0 0 0 1.6-2.7l-1.3-2.2', 'm14 16-3 3 3 3', 'M8.3 13.6 7.2 9.4 3 10.5', 'm9.3 5.3 1.4-2.5a1.8 1.8 0 0 1 3.1 0l3.1 5.4', 'm13.4 9.2 4.2 1.1 1.1-4.2'],
};
export function Icono({ n, className = 'ico' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[n].map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

/** Datos de la organización (perfil, configuración) para toda la zona de gestión. */
const OrgCtx = createContext(null);
export const useOrg = () => useContext(OrgCtx);

const leer = (k, def) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? def;
  } catch {
    return def;
  }
};

export default function Shell() {
  const user = getUser();
  const { pathname } = useLocation();
  const [org, setOrg] = useState(null);
  const [error, setError] = useState(null);
  const [min, setMin] = useState(() => leer('side-min', false));
  const [abierta, setAbierta] = useState(false);

  const recargar = useCallback(() => api('/planta/organizacion').then(setOrg).catch((e) => setError(e.message)), []);
  useEffect(() => {
    recargar();
  }, [recargar]);
  useEffect(() => setAbierta(false), [pathname]);
  useEffect(() => {
    try {
      localStorage.setItem('side-min', JSON.stringify(min));
    } catch {
      /* sin almacenamiento: el menú vuelve a abrirse */
    }
  }, [min]);

  if (error) return <p className="error" style={{ padding: 24 }}>{error}</p>;
  if (!org) return <p className="muted" style={{ padding: 24 }}>Cargando…</p>;

  const perfil = perfilDe(org.tipo);
  // El admin configura la organización antes de empezar (asistente)
  if (!org.configuracion?.onboarding && user.rol === 'admin' && !leer(`saltar-asistente-${org.id}`, false)) return <Navigate to="/bienvenida" replace />;

  const secciones = seccionesPara(perfil, user.rol);
  const { seccion, tab } = ubicar(secciones, pathname);
  const fuera = pathname === '/configuracion';
  const iniciales = org.nombre.split(/\s+/).filter((p) => /^[A-ZÁÉÍÓÚÑ]/.test(p)).slice(0, 2).map((p) => p[0]).join('') || org.nombre[0];

  return (
    <OrgCtx.Provider value={{ org, perfil, recargar }}>
      <div className={`shell ${min ? 'side-min' : ''} ${abierta ? 'side-abierta' : ''}`}>
        <aside className="side" aria-label="Menú principal">
          <div className="side-head">
            <Link className="logo" to="/panel" title="Gestión RSU">
              <span className="logo-mark"><Icono n="logo" /></span>
              <span className="nav-txt">Gestión RSU</span>
            </Link>
            <button type="button" className="side-btn colapsar" onClick={() => setMin(!min)} aria-label={min ? 'Expandir menú' : 'Comprimir menú'} title={min ? 'Expandir menú' : 'Comprimir menú'}>
              <Icono n={min ? 'expandir' : 'colapsar'} />
            </button>
          </div>
          <nav>
            <span className="nav-sec">{PERFILES[perfil]}</span>
            {secciones.map((s) => (
              <NavLink key={s.id} to={s.tabs[0].to} className={() => (seccion?.id === s.id ? 'active' : '')} title={s.label} aria-current={seccion?.id === s.id ? 'page' : undefined}>
                <Icono n={s.icono} />
                <span className="nav-txt">{s.label}</span>
              </NavLink>
            ))}
          </nav>
          <button type="button" className="side-salir" onClick={logout} title="Salir">
            <Icono n="salir" />
            <span className="nav-txt">Salir</span>
          </button>
        </aside>
        <div className="side-velo" onClick={() => setAbierta(false)} aria-hidden="true" />
        <div className="contenido">
          <header className="appbar">
            <div className="appbar-in">
              <div className="migas">
                <button type="button" className="menu-movil" onClick={() => setAbierta(true)} aria-label="Abrir menú">
                  <Icono n="menu" />
                </button>
                {fuera ? (
                  <b>Configuración</b>
                ) : (
                  <>
                    <span className="migas-sec">{seccion?.label}</span>
                    {seccion && <span className="migas-sep migas-sec">/</span>}
                    <b>{tab?.label}</b>
                  </>
                )}
              </div>
              <Link className="org" to="/configuracion" title="Configuración de la organización">
                <span className="org-av" aria-hidden="true">{iniciales.toUpperCase()}</span>
                <span className="org-t">
                  <b>{org.nombre}</b>
                  <span>{user.nombre} · {PERFILES[perfil]}</span>
                </span>
              </Link>
            </div>
          </header>
          {!fuera && seccion?.tabs.length > 1 && (
            <div className="subnav-bar">
              <nav className="subnav" aria-label={seccion.label}>
                {seccion.tabs.map((t) => (
                  <NavLink key={t.to} to={t.to} end={t.end}>
                    {t.label}
                  </NavLink>
                ))}
              </nav>
            </div>
          )}
          <main>
            <Outlet />
          </main>
        </div>
      </div>
    </OrgCtx.Provider>
  );
}
