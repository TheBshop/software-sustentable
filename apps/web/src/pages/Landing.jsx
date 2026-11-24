// Landing pública: título fuerte, subtítulo, video y CTA a WhatsApp para pedir una demo.
import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { esOperador, getToken, getUser } from '../api.js';

const WPP_DEMO = 'https://wa.me/5493435254141?text=' + encodeURIComponent(
  'Hola! Vi la página de Gestión RSU y me gustaría agendar una demo para conocer la plataforma.',
);

const PUNTOS = [
  { t: 'Cooperativas de reciclado', s: 'Organizá retiros, pesaje, lotes y ventas en un solo lugar. Tus choferes usan el celular, vos ves todo en tiempo real. Facturación ARCA, manifiestos y huella de carbono incluidos.' },
  { t: 'Empresas recicladoras', s: 'Trazabilidad completa de residuos, certificados verdes para tus clientes, reportes ESG automáticos y cumplimiento normativo por jurisdicción.' },
  { t: 'Municipios', s: 'Controlá la gestión de residuos de tu distrito: obligaciones legales, convenios con cooperativas, auditoría de operadores y reportes SNIGEI listos para presentar.' },
  { t: 'Generadores de residuos', s: 'Portal propio para ver retiros, certificados y facturas de tu operador. Descargá tu informe de impacto ambiental cuando lo necesites.' },
];

export default function Landing() {
  // Ya hay sesión: no mostrar la landing, mandar al panel que corresponda
  if (getToken()) {
    const u = getUser();
    const destino = u?.organizacion?.rol === 'plataforma' ? '/plataforma' : esOperador(u) ? '/panel' : '/portal';
    return <Navigate to={destino} replace />;
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
          <Link to="/calculadora-carbono">Calculadora CO₂</Link>
          <a href={WPP_DEMO} target="_blank" rel="noreferrer" className="secondary sm">Pedir una demo</a>
          <Link to="/login" className="primary button">Entrar</Link>
        </nav>
      </header>

      <section className="land-hero">
        <div className="land-hero-txt">
          <span className="land-eyebrow">Gestión sustentable integral — Argentina</span>
          <h1>Operación, trazabilidad y cumplimiento para el sector de residuos.</h1>
          <p className="land-lead">Gestión RSU es el único software argentino que junta la <strong>operación diaria</strong> de tu planta, la <strong>facturación ARCA</strong>, los <strong>manifiestos de ley</strong>, tus <strong>consumos</strong> de luz, gas, agua y combustible, y tu <strong>huella de carbono mensual</strong> — en una sola pantalla.</p>
          <div className="land-ctas">
            <Link to="/register" className="primary button">Crear cuenta gratis</Link>
            <Link to="/login" className="secondary button">Entrar a mi cuenta</Link>
            <a href={WPP_DEMO} target="_blank" rel="noreferrer" className="secondary button">Pedir una demo</a>
          </div>
        </div>
        <div className="land-hero-vid">
          <video src="/demo.mp4" poster="" controls preload="metadata" playsInline autoPlay muted loop>
            Tu navegador no soporta video embebido. <a href="/demo.mp4">Descargá el video</a>.
          </video>
        </div>
        <ul className="land-puntos land-puntos-bajo">
          {PUNTOS.map((p) => (
            <li key={p.t}><b>{p.t}</b><span>{p.s}</span></li>
          ))}
        </ul>
      </section>

      <section id="producto" className="land-prod">
        <h2>Una plataforma para toda la cadena</h2>
        <div className="land-grid">
          <article><h3>Operación</h3><p>Pedidos, retiros, pesaje, lotes (recepción → clasificado → enfardado → venta), rutinas de planta y tratamientos por corriente.</p></article>
          <article><h3>Comercial</h3><p>Presupuestos, ventas con precio de referencia, stock y margen, contratos, remitos numerados, facturación y convenio con el municipio.</p></article>
          <article><h3>Sustentabilidad</h3><p>Cargás tus consumos de luz, gas, agua y combustible, y la plataforma calcula tu huella de carbono mensual: lo que evitás por recuperar y lo que emitís en la operación.</p></article>
          <article><h3>Cumplimiento argentino</h3><p>Matriz con las leyes y ordenanzas de tu provincia y municipio, manifiestos de traslado con QR (Ley 25.612), reporte mensual tipo SNIGEI, certificados verdes.</p></article>
          <article><h3>Contabilidad lista para ARCA</h3><p>Facturación electrónica (Factura A/B/C con CAE), Libro IVA Ventas y Compras, Mayor de cuentas, importador desde Odoo.</p></article>
          <article><h3>Multi-organización</h3><p>Pensado para cooperativas chicas, federaciones y municipios con varias filiales. Cada organización tiene sus datos aislados; el superadmin consolida.</p></article>
        </div>
      </section>

      <CasoSNIGEI />

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
              <li>Facturación ARCA en homologación</li>
            </ul>
          </article>
          <article>
            <h3>Cooperativa</h3>
            <p><strong>$60.000 / mes</strong></p>
            <ul>
              <li>1 organización, hasta 10 usuarios</li>
              <li>Hasta 500 retiros/mes</li>
              <li>Facturación ARCA producción</li>
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
        <h2>¿Querés verlo con tus datos?</h2>
        <p className="muted">Agendamos 30 minutos por videollamada. Te mostramos cómo quedaría tu cooperativa, planta o municipio en la plataforma, con ejemplos reales del rubro. Sin compromiso.</p>
        <a href={WPP_DEMO} target="_blank" rel="noreferrer" className="primary button">Pedir una demo por WhatsApp</a>
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

function CasoSNIGEI() {
  const [data, setData] = useState(null);
  const [vista, setVista] = useState('totales');
  useEffect(() => {
    fetch('/api/public/snigei/caso-ejemplo').then((r) => r.ok ? r.json() : null).then(setData).catch(() => {});
  }, []);
  if (!data) return null;
  const f = (n) => n?.toLocaleString('es-AR', { maximumFractionDigits: 1 }) ?? '—';
  const { totales: t, porCorriente, porFraccion, porTratamiento, periodo, organizacion } = data;
  return (
    <section id="snigei" className="land-prod" style={{ background: 'var(--bg-sutil, #f0fdf4)' }}>
      <h2>Caso real: reporte mensual tipo SNIGEI</h2>
      <p className="muted">Así se ve el reporte que genera la plataforma automáticamente a partir de las operaciones cargadas. Este es un ejemplo de <strong>{organizacion}</strong>, {periodo.label}.</p>
      <div className="land-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={kpiStyle}><div style={{ fontSize: 24, fontWeight: 700 }}>{f(t.ingresoTn)}</div><div style={{ fontSize: 12, color: '#6b7280' }}>Toneladas ingresadas</div></div>
        <div style={kpiStyle}><div style={{ fontSize: 24, fontWeight: 700 }}>{f(t.ventaKg / 1000)}</div><div style={{ fontSize: 12, color: '#6b7280' }}>Toneladas vendidas</div></div>
        <div style={kpiStyle}><div style={{ fontSize: 24, fontWeight: 700, color: '#16a34a' }}>{f(t.tasaRecuperacionPct)}%</div><div style={{ fontSize: 12, color: '#6b7280' }}>Tasa de recupero</div></div>
        <div style={kpiStyle}><div style={{ fontSize: 24, fontWeight: 700, color: '#dc2626' }}>{f(t.disposicionFinalKg / 1000)}</div><div style={{ fontSize: 12, color: '#6b7280' }}>Tn a disposición final</div></div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {[['totales', 'Por corriente'], ['fraccion', 'Por fracción'], ['tratamiento', 'Por tratamiento']].map(([k, l]) => (
          <button key={k} className={vista === k ? 'primary sm' : 'secondary sm'} onClick={() => setVista(k)}>{l}</button>
        ))}
      </div>
      <table className="tabla" style={{ fontSize: 14 }}>
        <thead><tr><th>{vista === 'totales' ? 'Corriente' : vista === 'fraccion' ? 'Fracción' : 'Tratamiento'}</th><th style={{ textAlign: 'right' }}>Kg</th></tr></thead>
        <tbody>
          {(vista === 'totales' ? porCorriente : vista === 'fraccion' ? porFraccion : porTratamiento).map((r, i) => (
            <tr key={i}><td>{r.corriente || r.fraccion || r.tratamiento}</td><td style={{ textAlign: 'right' }}>{f(r.kg)}</td></tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginTop: 16, fontSize: 13, color: '#9ca3af' }}>El reporte SNIGEI es obligatorio para operadores registrados ante el MAyDS. Gestión RSU lo genera en un clic.</p>
    </section>
  );
}
const kpiStyle = { background: '#fff', borderRadius: 8, padding: '16px 12px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,.08)' };
