import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiForm, fileUrl, getUser, logout } from '../api.js';

const CONTENEDOR_COLOR = {
  Azul: '#3b82f6',
  Amarillo: '#eab308',
  Verde: '#22c55e',
  'Marrón / compostera': '#92400e',
  'Punto verde / punto limpio': '#6366f1',
  'Punto limpio municipal': '#dc2626',
  'Contenedor textil / donación': '#a855f7',
  'Basura común (negro)': '#374151',
};

export default function Vecino() {
  const navigate = useNavigate();
  const user = getUser();
  const fileRef = useRef(null);
  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [analizando, setAnalizando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);
  const [reportes, setReportes] = useState([]);
  const [vista, setVista] = useState('camara');
  const [guia, setGuia] = useState(null);

  useEffect(() => { cargarReportes(); cargarGuia(); }, []);

  async function cargarReportes() {
    try {
      const data = await api('/vecino/reportes');
      setReportes(data.items ?? []);
    } catch {}
  }

  async function cargarGuia() {
    try {
      const data = await api('/vecino/guia');
      setGuia(data);
    } catch {}
  }

  function onFoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFoto(file);
    setPreview(URL.createObjectURL(file));
    setResultado(null);
    setError(null);
  }

  async function analizar() {
    if (!foto) return;
    setAnalizando(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('foto', foto);
      if (navigator.geolocation) {
        try {
          const pos = await new Promise((ok, fail) => navigator.geolocation.getCurrentPosition(ok, fail, { timeout: 8000 }));
          fd.append('lat', pos.coords.latitude);
          fd.append('lng', pos.coords.longitude);
          fd.append('precision', pos.coords.accuracy);
        } catch {}
      }
      const data = await apiForm('/vecino/reportar', fd);
      setResultado(data);
      cargarReportes();
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalizando(false);
    }
  }

  function limpiar() {
    setFoto(null);
    setPreview(null);
    setResultado(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este reporte?')) return;
    try {
      await api(`/vecino/reportes/${id}`, { method: 'DELETE' });
      setReportes((r) => r.filter((x) => x._id !== id));
    } catch {}
  }

  const nombre = user?.nombre?.split(' ')[0] || 'Vecino';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fondo, #f5f7f8)' }}>
      {/* Header */}
      <header style={{ background: 'var(--verde, #0f766e)', color: '#fff', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: 13, opacity: 0.8 }}>Gestión RSU</span>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Hola, {nombre}</h1>
        </div>
        <button onClick={() => { logout(); navigate('/login', { replace: true }); }} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13 }}>Salir</button>
      </header>

      {/* Tabs */}
      <nav style={{ display: 'flex', gap: 0, background: '#fff', borderBottom: '1px solid var(--borde, #e2e8ea)' }}>
        {[['camara', '📷 Identificar'], ['reportes', '📋 Mis reportes'], ['guia', '♻️ Guía']].map(([k, label]) => (
          <button key={k} onClick={() => setVista(k)} style={{ flex: 1, padding: '12px 8px', border: 'none', borderBottom: vista === k ? '2px solid var(--verde, #0f766e)' : '2px solid transparent', background: 'none', fontWeight: vista === k ? 600 : 400, color: vista === k ? 'var(--verde, #0f766e)' : 'var(--gris, #5f7177)', cursor: 'pointer', fontSize: 14 }}>{label}</button>
        ))}
      </nav>

      <main style={{ maxWidth: 600, margin: '0 auto', padding: 16 }}>
        {/* ---- TAB CÁMARA ---- */}
        {vista === 'camara' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {!preview && (
              <div style={{ border: '2px dashed var(--borde, #e2e8ea)', borderRadius: 12, padding: 32, textAlign: 'center', background: '#fff' }}>
                <p style={{ fontSize: 15, marginBottom: 12 }}>Sacale una foto a tus residuos</p>
                <label style={{ display: 'inline-block', background: 'var(--verde, #0f766e)', color: '#fff', padding: '12px 24px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 15 }}>
                  Abrir cámara
                  <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFoto} style={{ display: 'none' }} />
                </label>
                <p style={{ fontSize: 12, color: 'var(--gris, #5f7177)', marginTop: 8 }}>También podés elegir una foto de la galería</p>
              </div>
            )}

            {preview && (
              <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--borde, #e2e8ea)' }}>
                <img src={preview} alt="Foto" style={{ width: '100%', maxHeight: 300, objectFit: 'cover' }} />
                <div style={{ padding: 16, display: 'flex', gap: 8 }}>
                  {!resultado && (
                    <>
                      <button onClick={analizar} disabled={analizando} style={{ flex: 1, background: 'var(--verde, #0f766e)', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 0', fontWeight: 600, cursor: 'pointer', fontSize: 15 }}>
                        {analizando ? 'Analizando…' : 'Identificar residuos'}
                      </button>
                      <button onClick={limpiar} style={{ background: '#fff', border: '1px solid var(--borde, #e2e8ea)', borderRadius: 8, padding: '12px 16px', cursor: 'pointer', fontSize: 14 }}>✕</button>
                    </>
                  )}
                  {resultado && (
                    <button onClick={limpiar} style={{ flex: 1, background: 'var(--verde, #0f766e)', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 0', fontWeight: 600, cursor: 'pointer', fontSize: 15 }}>Nueva foto</button>
                  )}
                </div>
              </div>
            )}

            {error && <p style={{ background: '#fef2f2', color: '#dc2626', padding: 12, borderRadius: 8, fontSize: 14 }}>{error}</p>}

            {resultado && (
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--borde, #e2e8ea)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Resultado del análisis</h3>
                {resultado.items?.map((it, i) => (
                  <div key={i} style={{ padding: 12, borderRadius: 8, background: 'var(--fondo, #f5f7f8)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <b style={{ fontSize: 15 }}>{it.tipo || it.material}</b>
                      <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 20, background: it.reciclable ? '#dcfce7' : '#fef2f2', color: it.reciclable ? '#166534' : '#991b1b' }}>
                        {it.reciclable ? 'Reciclable' : 'No reciclable'}
                      </span>
                    </div>
                    {it.material && it.material !== it.tipo && <span style={{ fontSize: 13, color: 'var(--gris)' }}>Material: {it.material}</span>}
                    {it.cantidad_estimada && <span style={{ fontSize: 13, color: 'var(--gris)' }}>Cantidad: {it.cantidad_estimada}</span>}
                    {it.guia && (
                      <div style={{ marginTop: 4, padding: 8, borderRadius: 6, background: '#fff', border: '1px solid var(--borde, #e2e8ea)' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: CONTENEDOR_COLOR[it.guia.contenedor] || '#374151' }}>
                          🗑️ {it.guia.contenedor}
                        </span>
                        <p style={{ margin: '4px 0 0', fontSize: 13 }}>{it.guia.instruccion}</p>
                      </div>
                    )}
                    {it.peligroso && <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>⚠️ Residuo peligroso</span>}
                  </div>
                ))}
                {resultado.observaciones && <p style={{ fontSize: 13, color: 'var(--gris)', margin: 0 }}>{resultado.observaciones}</p>}
                {resultado.recomendacion && (
                  <div style={{ padding: 10, borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                    <span style={{ fontSize: 13 }}>💡 {resultado.recomendacion}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ---- TAB REPORTES ---- */}
        {vista === 'reportes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ margin: 0 }}>Mis reportes</h3>
            {reportes.length === 0 && <p style={{ color: 'var(--gris)', fontSize: 14 }}>Todavía no tenés reportes. Sacale una foto a tus residuos para empezar.</p>}
            {reportes.map((r) => (
              <div key={r._id} style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--borde, #e2e8ea)', overflow: 'hidden' }}>
                {r.foto && <img src={fileUrl(r.foto)} alt="" style={{ width: '100%', height: 140, objectFit: 'cover' }} />}
                <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--gris)' }}>{new Date(r.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    <button onClick={() => eliminar(r._id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12 }}>Eliminar</button>
                  </div>
                  {(r.items ?? []).map((it, i) => (
                    <span key={i} style={{ fontSize: 13 }}>
                      {it.reciclable ? '♻️' : '🗑️'} {it.tipo || it.material}
                      {it.guia ? ` → ${it.guia.contenedor}` : ''}
                    </span>
                  ))}
                  {r.recomendacion && <p style={{ fontSize: 12, color: 'var(--gris)', margin: 0 }}>💡 {r.recomendacion}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ---- TAB GUÍA ---- */}
        {vista === 'guia' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ margin: 0 }}>Guía de reciclaje</h3>
            <p style={{ fontSize: 14, color: 'var(--gris)', margin: 0 }}>Referencia rápida para saber dónde va cada tipo de residuo.</p>
            {guia && Object.entries(guia).map(([tipo, info]) => (
              <div key={tipo} style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--borde, #e2e8ea)', padding: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <b style={{ fontSize: 15, textTransform: 'capitalize' }}>{tipo}</b>
                  <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 20, fontWeight: 600, color: '#fff', background: CONTENEDOR_COLOR[info.contenedor] || '#374151' }}>{info.contenedor}</span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--gris)' }}>{info.instruccion}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
