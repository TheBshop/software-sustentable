// Landing pública: título fuerte, subtítulo, botón "Probar la demo" y video del producto.
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api, esOperador, getToken, getUser, setToken, setUser } from '../api.js';

const PUNTOS = [
  { t: 'Especialistas en RSU argentino', s: 'Un sistema pensado para cooperativas, recicladoras y municipios de Argentina, no un ERP genérico adaptado.' },
  { t: 'Trazabilidad end-to-end', s: 'Del pedido al retiro, al lote, al remito y al certificado verde con QR público.' },
  { t: 'Cumplimiento guiado por jurisdicción', s: 'Matriz con las leyes nacionales, provinciales y municipales que te aplican, y evidencias con vencimientos.' },
  { t: 'Contador contento', s: 'Libro IVA Ventas y Compras, Mayor y balance exportables. Facturación electrónica AFIP integrada.' },
];

function Prototipos({ onEntrar }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    api('/demo/prototipos').then((r) => setItems(r.items)).catch((e) => setError(e.message));
  }, []);
  if (error) return <p className="muted small">La demo pública no está disponible en este entorno. Pedí acceso con el botón de abajo.</p>;
  if (!items) return <p className="muted small">Buscando prototipos…</p>;
  if (!items.length) return <p className="muted small">Todavía no hay prototipos cargados.</p>;
  return (
    <ul className="land-demos">
      {items.map((p) => (
        <li key={p.slug}>
          <div>
            <b>{p.nombre}</b>
            <span className="small muted">{p.perfil} · {p.ciudad}, {p.provincia}</span>
          </div>
          <button type="button" className="secondary sm" onClick={() => onEntrar(p.slug)}>Entrar</button>
        </li>
      ))}
    </ul>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const [abrirDemo, setAbrirDemo] = useState(false);

  // Ya hay sesión: no mostrar la landing, mandar al panel que corresponda
  if (getToken()) {
    const u = getUser();
    const destino = u?.organizacion?.rol === 'plataforma' ? '/plataforma' : esOperador(u) ? '/panel' : '/portal';
    return <Navigate to={destino} replace />;
  }

  async function entrar(slug) {
    try {
      const { token, user } = await api('/demo/entrar', { method: 'POST', body: { slug } });
      setToken(token);
      setUser(user);
      navigate('/');
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <div className="land">
      <header className="land-top">
        <Link to="/" className="land-logo">
          <span className="logo-mark"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 19H4.8a1.8 1.8 0 0 1-1.6-2.7l1.2-2" /><path d="M11 19h8.2a1.8 1.8 0 0 0 1.6-2.7l-1.3-2.2" /><path d="m14 16-3 3 3 3" /><path d="M8.3 13.6 7.2 9.4 3 10.5" /><path d="m9.3 5.3 1.4-2.5a1.8 1.8 0 0 1 3.1 0l3.1 5.4" /><path d="m13.4 9.2 4.2 1.1 1.1-4.2" /></svg></span>
          <span>Gestión RSU</span>
        </Link>
        <nav className="land-nav">
          <a href="#producto">Producto</a>
          <a href="#demo">Demo</a>
          <Link to="/login">Ingresar</Link>
          <button type="button" className="primary sm" onClick={() => setAbrirDemo(true)}>Probar la demo</button>
        </nav>
      </header>

      <section className="land-hero">
        <div className="land-hero-txt">
          <span className="land-eyebrow">SaaS especializada en gestión de residuos — Argentina</span>
          <h1>El reciclaje, en orden y al día.</h1>
          <p className="land-lead">La plataforma hecha para cooperativas, empresas recicladoras y municipios argentinos. Diseñada con la normativa nacional, provincial y municipal como base, no como anexo. Reemplaza las planillas, el ERP genérico y el cumplimiento improvisado.</p>
          <div className="land-ctas">
            <button type="button" className="primary" onClick={() => setAbrirDemo(true)}>Probar la demo</button>
            <a href="#demo" className="secondary button">Ver el video</a>
          </div>
          <ul className="land-puntos">
            {PUNTOS.map((p) => (
              <li key={p.t}><b>{p.t}</b><span>{p.s}</span></li>
            ))}
          </ul>
        </div>
        <div className="land-hero-vid">
          <video src="/demo.mp4" poster="" controls preload="metadata" playsInline autoPlay muted loop>
            Tu navegador no soporta video embebido. <a href="/demo.mp4">Descargá el video</a>.
          </video>
        </div>
      </section>

      <section id="producto" className="land-prod">
        <h2>Una plataforma para toda la cadena</h2>
        <div className="land-grid">
          <article><h3>Operación</h3><p>Pedidos, retiros, pesaje, lotes (recepción → clasificado → enfardado → venta), rutinas de planta y tratamientos por corriente.</p></article>
          <article><h3>Comercial</h3><p>Compras, ventas con precio de referencia, stock y margen, contratos, remitos numerados, facturación y convenio con el municipio.</p></article>
          <article><h3>Métricas y sustentabilidad</h3><p>KPIs con variación vs. período anterior, desglose por fracción, huella de carbono (SNIGEI-AR 2025), emisiones evitadas (EPA WARM) y memoria anual en PDF y Excel.</p></article>
          <article><h3>Cumplimiento argentino</h3><p>Matriz con las leyes y ordenanzas de tu provincia y municipio, con evidencias y vencimientos. Autodiagnóstico, normativa y clasificador en 3 niveles.</p></article>
          <article><h3>Contabilidad lista para AFIP</h3><p>Facturación electrónica (Factura A/B/C/E con CAE), Libro IVA Ventas y Compras, Mayor de cuentas, exportables en el formato que usa tu contador.</p></article>
          <article><h3>Multi-organización</h3><p>Pensado para cooperativas chicas, federaciones y municipios con varias filiales. Cada organización tiene sus datos aislados; el superadmin consolida.</p></article>
        </div>
      </section>

      <section id="demo" className="land-demo">
        <h2>Probala con datos reales</h2>
        <p className="muted">Entrá a los prototipos de ejemplo cargados en el entorno de demostración. Vas al panel completo, sin instalar nada.</p>
        {abrirDemo ? <Prototipos onEntrar={entrar} /> : (
          <button type="button" className="primary" onClick={() => setAbrirDemo(true)}>Ver los prototipos disponibles</button>
        )}
      </section>

      <footer className="land-foot">
        <span>Gestión RSU — Argentina, {new Date().getFullYear()}</span>
        <Link to="/login">Entrar con mi usuario</Link>
      </footer>
    </div>
  );
}
