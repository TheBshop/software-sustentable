import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { getToken, setToken } from './api.js';
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
import VerificarCertificado from './pages/VerificarCertificado.jsx';
import './styles.css';

function Badge({ n, alert }) {
  return n ? <span className={`nav-badge ${alert ? 'alert' : ''}`}>{n}</span> : null;
}

function Sidebar() {
  // Contadores de lo que necesita atención: retiros sin pesar y cobros vencidos/por vencer
  const sinPesar = useLoad('/retiros?estado=registrado&limit=1');
  const alertas = useLoad('/facturas/alertas?dias=7');
  const nAlertas = (alertas.data?.vencidas.length ?? 0) + (alertas.data?.porVencer.length ?? 0);
  return (
    <nav className="sidebar">
      <h1>♻ Nueva Vida</h1>
      <span className="nav-group">Operación</span>
      <NavLink to="/" end>Inicio</NavLink>
      <NavLink to="/retiros">Retiros <Badge n={sinPesar.data?.total} /></NavLink>
      <NavLink to="/ingresos">Ingresos a planta</NavLink>
      <NavLink to="/ventas">Ventas</NavLink>
      <span className="nav-group">Clientes</span>
      <NavLink to="/certificados">Certificados</NavLink>
      <NavLink to="/facturacion">Facturación <Badge n={nAlertas} alert={alertas.data?.vencidas.length > 0} /></NavLink>
      <NavLink to="/clientes">Clientes</NavLink>
      <NavLink to="/materiales">Materiales</NavLink>
      <button
        className="link logout"
        onClick={() => {
          setToken(null);
          window.location.href = '/login';
        }}
      >
        Salir
      </button>
    </nav>
  );
}

function Layout() {
  const { pathname } = useLocation();
  if (!getToken()) return <Navigate to="/login" replace />;
  return (
    <div className="layout">
      {/* key: los contadores se actualizan al cambiar de pantalla */}
      <Sidebar key={pathname} />
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
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="/retiros" element={<Retiros />} />
          <Route path="/ingresos" element={<Ingresos />} />
          <Route path="/ventas" element={<Ventas />} />
          <Route path="/certificados" element={<Certificados />} />
          <Route path="/facturacion" element={<Facturacion />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/materiales" element={<Materiales />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
