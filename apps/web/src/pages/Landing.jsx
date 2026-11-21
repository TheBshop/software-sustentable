// Landing pública: título fuerte, subtítulo, botón "Probar la demo" y video del producto.
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api, esOperador, getToken, getUser, setToken, setUser } from '../api.js';

const PUNTOS = [
  { t: 'Me paso el mes atrás de los choferes y las planillas', s: 'Panel operativo en vivo: retiros, pesaje, ingresos a planta y ventas desde cualquier dispositivo. El chofer entra con su usuario desde el celular.' },
  { t: 'El contador me cobra una fortuna por cada DDJJ', s: 'Libro IVA Ventas y Compras, Mayor, facturación AFIP con CAE y DDJJ mensual de materiales reciclables generados desde las operaciones.' },
  { t: 'Mi cliente grande me pide reporte de impacto', s: 'PDF firmado mensual con CO₂ evitado, toneladas recuperadas y trazabilidad. Lo mandás y tu cliente lo usa para su reporte ESG.' },
  { t: 'Vivo con miedo a la auditoría municipal', s: 'Matriz de obligaciones por jurisdicción, vencimientos con alerta y manifiestos de traslado con QR y firma digital (Ley 25.612).' },
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

  function probarDemo() {
    setAbrirDemo(true);
    setTimeout(() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

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
          <a href="#precios">Planes</a>
          <button type="button" className="secondary sm" onClick={probarDemo}>Probar la demo</button>
          <Link to="/login" className="primary button">Entrar</Link>
        </nav>
      </header>

      <section className="land-hero">
        <div className="land-hero-txt">
          <span className="land-eyebrow">Gestión sustentable integral — Argentina</span>
          <h1>Sacale el contador, la planilla y la carpeta de normativa a tu cooperativa.</h1>
          <p className="land-lead">Gestión RSU es el único software argentino que junta la <strong>operación diaria</strong> de tu planta, la <strong>facturación AFIP</strong>, los <strong>manifiestos de ley</strong>, tus <strong>consumos</strong> de luz, gas, agua y combustible, y tu <strong>huella de carbono mensual</strong> — en una sola pantalla.</p>
          <div className="land-ctas">
            <Link to="/login" className="primary button">Entrar a mi cuenta</Link>
            <button type="button" className="secondary" onClick={probarDemo}>Probar la demo</button>
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
          <button type="button" className="primary" onClick={probarDemo}>Ver los prototipos disponibles</button>
        )}
      </section>

      <footer className="land-foot">
        <span>Gestión RSU — Argentina, {new Date().getFullYear()}</span>
        <Link to="/login">Entrar con mi usuario</Link>
      </footer>

      <a href="https://wa.me/5493435254141?text=Hola!%20Quiero%20saber%20m%C3%A1s%20sobre%20Gesti%C3%B3n%20RSU" target="_blank" rel="noreferrer" className="wpp-float" aria-label="Escribinos por WhatsApp">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M20.52 3.48A11.9 11.9 0 0 0 12.06 0C5.46 0 .08 5.37.08 11.96c0 2.11.55 4.17 1.6 5.99L0 24l6.22-1.63a11.95 11.95 0 0 0 5.84 1.49h.01c6.6 0 11.98-5.37 11.98-11.96a11.9 11.9 0 0 0-3.53-8.42zM12.07 21.79h-.01a9.9 9.9 0 0 1-5.05-1.38l-.36-.22-3.69.97.98-3.6-.24-.37a9.87 9.87 0 0 1-1.51-5.23c0-5.47 4.46-9.92 9.94-9.92 2.65 0 5.15 1.03 7.02 2.9a9.87 9.87 0 0 1 2.91 7.02c0 5.47-4.46 9.83-9.99 9.83zm5.46-7.4c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.35.19 1.86.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35z"/></svg>
      </a>
    </div>
  );
}
