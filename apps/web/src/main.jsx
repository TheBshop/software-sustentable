import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { getToken, getUser, esOperador, logout } from './api.js';
import Shell from './shell/Shell.jsx';
import Login from './pages/Login.jsx';
import Bienvenida from './pages/Bienvenida.jsx';
import Panel from './pages/inicio/Panel.jsx';
import Pasos from './pages/inicio/Pasos.jsx';
import Registros from './pages/Registros.jsx';
import Proceso from './pages/operacion/Proceso.jsx';
import Rutinas from './pages/operacion/Rutinas.jsx';
import Tratamientos from './pages/operacion/Tratamientos.jsx';
import Remitos from './pages/comercial/Remitos.jsx';
import Compras from './pages/comercial/Compras.jsx';
import Stock from './pages/comercial/Stock.jsx';
import Contratos from './pages/comercial/Contratos.jsx';
import Convenio from './pages/comercial/Convenio.jsx';
import { ClientesYProveedores, BalanceYCaja } from './pages/comercial/Extras.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Indicadores from './pages/resultados/Indicadores.jsx';
import Retiros from './pages/Retiros.jsx';
import Certificados from './pages/Certificados.jsx';
import Facturacion from './pages/Facturacion.jsx';
import Materiales from './pages/Materiales.jsx';
import Ingresos from './pages/Ingresos.jsx';
import Ventas from './pages/Ventas.jsx';
import Configuracion from './pages/Configuracion.jsx';
import Seguridad from './pages/Seguridad.jsx';
import Normativa from './pages/Normativa.jsx';
import Sustentabilidad from './pages/resultados/Sustentabilidad.jsx';
import Matriz from './pages/cumplimiento/Matriz.jsx';
import Autodiagnostico from './pages/cumplimiento/Autodiagnostico.jsx';
import Demo from './pages/Demo.jsx';
import Productividad from './pages/Productividad.jsx';
import Agenda from './pages/Agenda.jsx';
import Clasificar from './pages/Clasificar.jsx';
import Recuperadores from './pages/Recuperadores.jsx';
import PortalPedidos from './pages/portal/Pedidos.jsx';
import VerificarCertificado from './pages/VerificarCertificado.jsx';
import PortalInicio from './pages/portal/Inicio.jsx';
import PortalRetiros from './pages/portal/Retiros.jsx';
import PortalCertificados from './pages/portal/Certificados.jsx';
import PortalFacturas from './pages/portal/Facturas.jsx';
import PortalInforme from './pages/portal/Informe.jsx';
import PortalUsuarios from './pages/portal/Usuarios.jsx';
import PortalShell from './pages/portal/PortalShell.jsx';
import Plataforma from './pages/plataforma/Plataforma.jsx';
import Landing from './pages/Landing.jsx';
import './styles.css';
import './shell.css';

/** Exige sesión y que el tipo de organización corresponda a la zona (gestión, portal o plataforma). */
function Zona({ portal, children }) {
  const user = getUser();
  if (!getToken() || !user) return <Navigate to="/login" replace />;
  if (user.organizacion?.rol === 'plataforma') return <Navigate to="/plataforma" replace />;
  if (!portal && !esOperador(user)) return <Navigate to="/portal" replace />;
  if (portal && esOperador(user)) return <Navigate to="/panel" replace />;
  if (!portal) return children;
  return <PortalShell />;
}

/** Puerta a la administración de la plataforma. */
function GateAdmin({ children }) {
  const user = getUser();
  if (!getToken() || user?.organizacion?.rol !== 'plataforma') return <Navigate to="/login" replace />;
  return children;
}

/** Rutas anteriores → nuevas (enlaces guardados y links internos de las pantallas existentes). */
const ANTERIORES = {
  '/retiros': '/operacion/retiros',
  '/ingresos': '/operacion/planta',
  '/agenda': '/operacion/agenda',
  '/recuperadores': '/operacion/recuperadores',
  '/productividad': '/operacion/productividad',
  '/seguridad': '/operacion/seguridad',
  '/ventas': '/comercial/ventas',
  '/clientes': '/comercial/clientes',
  '/materiales': '/comercial/materiales',
  '/facturacion': '/comercial/facturacion',
  '/balance': '/comercial/balance',
  '/certificados': '/cumplimiento/certificados',
  '/normativa': '/cumplimiento',
  '/clasificar': '/cumplimiento/clasificar',
};
function Redirigir({ a }) {
  const { search } = useLocation();
  return <Navigate to={`${a}${search}`} replace />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/plataforma" element={<GateAdmin><Plataforma /></GateAdmin>} />
        {/* Selector de prototipos: solo responde con la API en modo demostración */}
        <Route path="/demo" element={<main className="demo-main"><Demo /></main>} />
        {/* Página pública a la que apunta el QR del certificado */}
        <Route path="/verificar/:codigo" element={<VerificarCertificado />} />
        <Route path="/bienvenida" element={<Zona><Bienvenida /></Zona>} />
        <Route element={<Zona><Shell /></Zona>}>
          <Route path="/panel" element={<Panel />} />
          <Route path="/inicio/pasos" element={<Pasos />} />
          <Route path="/operacion" element={<Navigate to="/operacion/registros" replace />} />
          <Route path="/operacion/proceso" element={<Proceso />} />
          <Route path="/operacion/registros" element={<Registros />} />
          <Route path="/operacion/rutinas" element={<Rutinas />} />
          <Route path="/operacion/tratamientos" element={<Tratamientos />} />
          <Route path="/comercial/remitos" element={<Remitos />} />
          <Route path="/comercial/compras" element={<Compras />} />
          <Route path="/comercial/stock" element={<Stock />} />
          <Route path="/comercial/contratos" element={<Contratos />} />
          <Route path="/comercial/convenio" element={<Convenio />} />
          <Route path="/operacion/agenda" element={<Agenda />} />
          <Route path="/operacion/retiros" element={<Retiros />} />
          <Route path="/operacion/planta" element={<Ingresos />} />
          <Route path="/operacion/recuperadores" element={<Recuperadores />} />
          <Route path="/operacion/productividad" element={<Productividad />} />
          <Route path="/operacion/seguridad" element={<Seguridad />} />
          <Route path="/comercial" element={<Navigate to="/comercial/ventas" replace />} />
          <Route path="/comercial/ventas" element={<Ventas />} />
          <Route path="/comercial/clientes" element={<ClientesYProveedores />} />
          <Route path="/comercial/materiales" element={<Materiales />} />
          <Route path="/comercial/facturacion" element={<Facturacion />} />
          <Route path="/comercial/balance" element={<BalanceYCaja />} />
          <Route path="/resultados" element={<Indicadores />} />
          <Route path="/resultados/sustentabilidad" element={<Sustentabilidad />} />
          <Route path="/cumplimiento" element={<Matriz />} />
          <Route path="/cumplimiento/autodiagnostico" element={<Autodiagnostico />} />
          <Route path="/cumplimiento/normativa" element={<Normativa />} />
          <Route path="/cumplimiento/certificados" element={<Certificados />} />
          <Route path="/cumplimiento/clasificar" element={<Clasificar />} />
          <Route path="/configuracion" element={<Configuracion />} />
          {Object.entries(ANTERIORES).map(([de, a]) => <Route key={de} path={de} element={<Redirigir a={a} />} />)}
        </Route>
        <Route path="/portal" element={<Zona portal />}>
          <Route index element={<PortalInicio />} />
          <Route path="pedidos" element={<PortalPedidos />} />
          <Route path="clasificar" element={<Clasificar base="/v1/portal/clasificador" />} />
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
