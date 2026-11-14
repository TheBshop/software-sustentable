import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { getToken, getUser, esCooperativa, logout } from './api.js';
import { useLoad } from './ui.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Retiros from './pages/Retiros.jsx';
import Certificados from './pages/Certificados.jsx';
import Facturacion from './pages/Facturacion.jsx';
import Clientes from './pages/Clientes.jsx';
import Materiales from './pages/Materiales.jsx';
import Ingresos from './pages/Ingresos.jsx';
import Ventas from './pages/Ventas.jsx';
import Balance from './pages/Balance.jsx';
import Configuracion from './pages/Configuracion.jsx';
import Seguridad from './pages/Seguridad.jsx';
import VerificarCertificado from './pages/VerificarCertificado.jsx';
import PortalInicio from './pages/portal/Inicio.jsx';
import PortalRetiros from './pages/portal/Retiros.jsx';
import PortalCertificados from './pages/portal/Certificados.jsx';
import PortalFacturas from './pages/portal/Facturas.jsx';
import PortalInforme from './pages/portal/Informe.jsx';
import PortalUsuarios from './pages/portal/Usuarios.jsx';
import './styles.css';

function Badge({ n, alert }) {
  return n ? <span className={`nav-badge ${alert ? 'alert' : ''}`}>{n}</span> : null;
}

function Salir() {
  return (
    <button className="link logout" onClick={logout}>
      Salir
    </button>
  );
}

function CoopSidebar() {
  // Contadores de lo que necesita atención: retiros sin pesar y cobros vencidos/por vencer
  const sinPesar = useLoad('/retiros?estado=registrado&limit=1');
  const alertas = useLoad('/facturas/alertas?dias=7');
  const nAlertas = (alertas.data?.vencidas.length ?? 0) + (alertas.data?.porVencer.length ?? 0);
  return (
    <nav className="sidebar">
      <h1>♻ {getUser()?.organizacion?.nombre}</h1>
      <span className="nav-group">Operación</span>
      <NavLink to="/" end>Inicio</NavLink>
      <NavLink to="/retiros">Retiros <Badge n={sinPesar.data?.total} /></NavLink>
      <NavLink to="/ingresos">Planta y stock</NavLink>
      <NavLink to="/ventas">Ventas</NavLink>
      <span className="nav-group">Clientes</span>
      <NavLink to="/certificados">Certificados</NavLink>
      <NavLink to="/facturacion">Facturación <Badge n={nAlertas} alert={alertas.data?.vencidas.length > 0} /></NavLink>
      <NavLink to="/clientes">Clientes</NavLink>
      <NavLink to="/materiales">Materiales</NavLink>
      {['admin', 'administracion'].includes(getUser()?.rol) && (
        <>
          <span className="nav-group">Administración</span>
          <NavLink to="/balance">Balance</NavLink>
          <NavLink to="/seguridad">Seguridad e higiene</NavLink>
          {getUser()?.rol === 'admin' && <NavLink to="/configuracion">Configuración</NavLink>}
        </>
      )}
      <Salir />
    </nav>
  );
}

function PortalSidebar() {
  const user = getUser();
  return (
    <nav className="sidebar portal">
      <h1>♻ {user?.organizacion?.nombre}</h1>
      <span className="nav-group">{user?.organizacion?.tipo === 'municipio' ? 'Portal del municipio' : 'Portal de la empresa'}</span>
      <NavLink to="/portal" end>Impacto</NavLink>
      <NavLink to="/portal/retiros">Retiros</NavLink>
      <NavLink to="/portal/certificados">Certificados</NavLink>
      <NavLink to="/portal/facturas">Facturas</NavLink>
      <NavLink to="/portal/informe">Informe anual</NavLink>
      {user?.rol === 'cliente_admin' && <NavLink to="/portal/usuarios">Usuarios</NavLink>}
      <Salir />
    </nav>
  );
}

/** Exige sesión y que el tipo de organización corresponda a la zona (gestión o portal). */
function Zona({ portal }) {
  const { pathname } = useLocation();
  const user = getUser();
  if (!getToken() || !user) return <Navigate to="/login" replace />;
  if (!portal && !esCooperativa(user)) return <Navigate to="/portal" replace />;
  if (portal && esCooperativa(user)) return <Navigate to="/" replace />;
  return (
    <div className="layout">
      {/* key: los contadores se actualizan al cambiar de pantalla */}
      {portal ? <PortalSidebar /> : <CoopSidebar key={pathname} />}
      <main>
        <Outlet />
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        {/* Página pública a la que apunta el QR del certificado */}
        <Route path="/verificar/:codigo" element={<VerificarCertificado />} />
        <Route element={<Zona />}>
          <Route index element={<Dashboard />} />
          <Route path="/retiros" element={<Retiros />} />
          <Route path="/ingresos" element={<Ingresos />} />
          <Route path="/ventas" element={<Ventas />} />
          <Route path="/certificados" element={<Certificados />} />
          <Route path="/facturacion" element={<Facturacion />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/materiales" element={<Materiales />} />
          <Route path="/balance" element={<Balance />} />
          <Route path="/configuracion" element={<Configuracion />} />
          <Route path="/seguridad" element={<Seguridad />} />
        </Route>
        <Route path="/portal" element={<Zona portal />}>
          <Route index element={<PortalInicio />} />
          <Route path="retiros" element={<PortalRetiros />} />
          <Route path="certificados" element={<PortalCertificados />} />
          <Route path="facturas" element={<PortalFacturas />} />
          <Route path="informe" element={<PortalInforme />} />
          <Route path="usuarios" element={<PortalUsuarios />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
