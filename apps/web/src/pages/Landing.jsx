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
        <Link to="/" className="land-logo" aria-label="Gestión RSU — Inicio">
          <img src="/logo.svg" alt="Gestión RSU" height="40" style={{ display: 'block' }} />
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
          <span className="land-eyebrow">Gestión sustentable integral — Argentina</span>
          <h1>Residuos, consumos y huella de carbono en un solo lugar.</h1>
          <p className="land-lead">La plataforma hecha para cooperativas, empresas recicladoras, industrias y municipios argentinos. Gestionás residuos, medís tus consumos de luz, gas, agua y combustible, y obtenés tu huella de carbono mensual. Diseñada con la normativa argentina como base, no como anexo.</p>
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
          <article><h3>Comercial</h3><p>Presupuestos, ventas con precio de referencia, stock y margen, contratos, remitos numerados, facturación y convenio con el municipio.</p></article>
          <article><h3>Sustentabilidad</h3><p>Cargás tus consumos de luz, gas, agua y combustible, y la plataforma calcula tu huella de carbono mensual: lo que evitás por recuperar y lo que emitís en la operación.</p></article>
          <article><h3>Cumplimiento argentino</h3><p>Matriz con las leyes y ordenanzas de tu provincia y municipio, manifiestos de traslado con QR (Ley 25.612), reporte mensual tipo SNIGEI, certificados verdes.</p></article>
          <article><h3>Contabilidad lista para AFIP</h3><p>Facturación electrónica (Factura A/B/C con CAE), Libro IVA Ventas y Compras, Mayor de cuentas, importador desde Odoo.</p></article>
          <article><h3>Multi-organización</h3><p>Pensado para cooperativas chicas, federaciones y municipios con varias filiales. Cada organización tiene sus datos aislados; el superadmin consolida.</p></article>
        </div>
      </section>

      <section id="precios" className="land-prod">
        <h2>Planes</h2>
        <p className="muted">Durante el programa piloto el uso es gratuito por 3 meses. Después, estos son los planes previstos — sujeto a ajuste con el feedback de los pilotos.</p>
        <div className="land-grid">
          <article>
            <h3>Piloto</h3>
            <p><strong>Gratis · 3 meses</strong></p>
            <ul>
              <li>1 organización</li>
              <li>Hasta 5 usuarios</li>
              <li>Todos los módulos</li>
              <li>Soporte directo por WhatsApp</li>
              <li>Facturación AFIP en homologación</li>
            </ul>
          </article>
          <article>
            <h3>Cooperativa</h3>
            <p><strong>$60.000 / mes</strong></p>
            <ul>
              <li>1 organización, hasta 10 usuarios</li>
              <li>Hasta 500 retiros/mes</li>
              <li>Facturación AFIP producción</li>
              <li>Backup diario + export ZIP</li>
              <li>Soporte en horario hábil</li>
            </ul>
          </article>
          <article>
            <h3>Recicladora / Industria</h3>
            <p><strong>$120.000 / mes</strong></p>
            <ul>
              <li>Hasta 25 usuarios</li>
              <li>Multi-sitio (hasta 3)</li>
              <li>Huella de carbono consolidada</li>
              <li>Logo y colores propios</li>
              <li>Soporte prioritario</li>
            </ul>
          </article>
          <article>
            <h3>Municipio / Federación</h3>
            <p><strong>A medida</strong></p>
            <ul>
              <li>Multi-organización sin límite</li>
              <li>Panel consolidado</li>
              <li>Integraciones a medida</li>
              <li>Dominio propio</li>
              <li>Capacitación on-site</li>
            </ul>
          </article>
        </div>
        <p className="muted" style={{ marginTop: 16 }}>Precios en pesos argentinos con IVA incluido, al <strong>{new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</strong>. ¿Tenés dudas? <a href="https://wa.me/5493435254141" target="_blank" rel="noreferrer">Escribinos por WhatsApp</a>.</p>
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
