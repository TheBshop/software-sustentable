import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, NavLink, Outlet } from 'react-router-dom';
import { getToken, setToken } from './api.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Clientes from './pages/Clientes.jsx';
import VerificarCertificado from './pages/VerificarCertificado.jsx';
import './styles.css';

function Layout() {
  if (!getToken()) return <Navigate to="/login" replace />;
  return (
    <div className="layout">
      <nav className="sidebar">
        <h1>♻ Nueva Vida</h1>
        <NavLink to="/">Dashboard</NavLink>
        <NavLink to="/clientes">Clientes</NavLink>
        {/* Próximos sprints: Retiros, Ingresos a planta, Ventas, Materiales, Facturas */}
        <button
          className="link"
          onClick={() => {
            setToken(null);
            window.location.href = '/login';
          }}
        >
          Salir
        </button>
      </nav>
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
          <Route path="/clientes" element={<Clientes />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
