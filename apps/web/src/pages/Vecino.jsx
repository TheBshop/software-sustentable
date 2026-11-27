import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiForm, getUser, getToken, logout } from '../api.js';

const BASE = import.meta.env.VITE_API_URL || '';

const CONTENEDOR_COLOR = {
  Azul: '#3b82f6', Amarillo: '#eab308', Verde: '#22c55e',
  'Marrón / compostera': '#92400e', 'Punto verde / punto limpio': '#6366f1',
  'Punto limpio municipal': '#dc2626', 'Contenedor textil / donación': '#a855f7',
  'Basura común (negro)': '#374151',
};

const MATERIALES_RETIRO = ['Papel/cartón', 'Plásticos', 'Vidrio', 'Metales', 'Electrónicos', 'Textiles', 'Otros'];
const FRANJA = { manana: 'Mañana (8-12)', tarde: 'Tarde (14-18)', todo_el_dia: 'Todo el día' };
const ESTADO_RETIRO = { pendiente: { label: 'Pendiente', bg: '#fef3c7', color: '#92400e' }, confirmado: { label: 'Confirmado', bg: '#dbeafe', color: '#1e40af' }, retirado: { label: 'Retirado', bg: '#dcfce7', color: '#166534' }, cancelado: { label: 'Cancelado', bg: '#fee2e2', color: '#991b1b' } };
const fmtKg = (n) => Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 1 });
const fmtFecha = (d) => d ? new Date(d).toLocaleDateString('es-AR') : '-';

export default function Vecino() {
  const navigate = useNavigate();
  const user = getUser();
  const fileRef = useRef(null);

  const [vista, setVista] = useState('inicio');
  const [stats, setStats] = useState(null);
  const [guia, setGuia] = useState(null);

  // Identificar
  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [analizando, setAnalizando] = useState(false);
  const [resultado, setResultado] = useState(null);

  // Historial
  const [historial, setHistorial] = useState([]);

  // Retiros
  const [retiros, setRetiros] = useState([]);
  const [retiroForm, setRetiroForm] = useState({ direccion: '', ciudad: '', fechaPreferida: '', franjaHoraria: 'todo_el_dia', materiales: [], observaciones: '', pesoEstimadoKg: '' });
  const [creandoRetiro, setCreandoRetiro] = useState(false);

  // Perfil
  const [perfil, setPerfil] = useState({ telefono: '', dni: '', direccion: '', ciudad: '', provincia: '', fechaNacimiento: '' });
  const [editandoPerfil, setEditandoPerfil] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { cargarTodo(); }, []);

  async function cargarTodo() {
    try {
      const [s, g, h, r, p] = await Promise.all([
        api('/vecino/stats').catch(() => null),
        api('/vecino/guia').catch(() => null),
        api('/vecino/identificaciones').catch(() => ({ items: [] })),
        api('/vecino/retiros').catch(() => ({ items: [] })),
        api('/vecino/perfil').catch(() => null),
      ]);
      if (s) setStats(s);
      if (g) setGuia(g);
      setHistorial(h.items ?? []);
      setRetiros(r.items ?? []);
      if (p) setPerfil({ telefono: p.telefono ?? '', dni: p.dni ?? '', direccion: p.direccion ?? '', ciudad: p.ciudad ?? '', provincia: p.provincia ?? '', fechaNacimiento: p.fechaNacimiento ? new Date(p.fechaNacimiento).toISOString().slice(0, 10) : '' });
    } catch {}
  }

  // ---- Identificar ----
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
      const data = await apiForm('/vecino/identificar', fd);
      setResultado(data);
      setStats((s) => s ? { ...s, identificaciones: s.identificaciones + 1, pesoKg: s.pesoKg + (data.pesoEstimadoKg ?? 0), co2Kg: s.co2Kg + (data.co2EvitadoKg ?? 0) } : s);
    } catch (err) { setError(err.message); } finally { setAnalizando(false); }
  }

  function limpiarFoto() {
    setFoto(null); setPreview(null); setResultado(null); setError(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  // ---- Retiros ----
  function toggleMaterial(m) {
    setRetiroForm((f) => ({ ...f, materiales: f.materiales.includes(m) ? f.materiales.filter((x) => x !== m) : [...f.materiales, m] }));
  }

  async function crearRetiro(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api('/vecino/retiros', { method: 'POST', body: JSON.stringify({ ...retiroForm, pesoEstimadoKg: retiroForm.pesoEstimadoKg ? Number(retiroForm.pesoEstimadoKg) : undefined }), headers: { 'Content-Type': 'application/json' } });
      setRetiroForm({ direccion: '', ciudad: '', fechaPreferida: '', franjaHoraria: 'todo_el_dia', materiales: [], observaciones: '', pesoEstimadoKg: '' });
      setCreandoRetiro(false);
      const r = await api('/vecino/retiros');
      setRetiros(r.items ?? []);
      const s = await api('/vecino/stats');
      setStats(s);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  async function cancelarRetiro(id) {
    if (!confirm('¿Cancelar este retiro?')) return;
    try { await api(`/vecino/retiros/${id}`, { method: 'DELETE' }); const r = await api('/vecino/retiros'); setRetiros(r.items ?? []); } catch {}
  }

  // ---- Perfil ----
  async function guardarPerfil(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api('/vecino/perfil', { method: 'PUT', body: JSON.stringify(perfil), headers: { 'Content-Type': 'application/json' } });
      setEditandoPerfil(false);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  // ---- Certificado ----
  async function descargarCertificado() {
    try {
      const token = getToken();
      const res = await fetch(`${BASE}/api/vecino/certificado`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? 'Error al generar certificado'); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'certificado-reciclaje.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { setError(err.message); }
  }

  const nombre = user?.nombre?.split(' ')[0] || 'Vecino';

  // Styles
  const btn = { background: 'var(--verde, #0f766e)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 14 };
  const btnSec = { ...btn, background: '#fff', color: 'var(--verde, #0f766e)', border: '1px solid var(--borde, #e2e8ea)' };
  const card = { background: '#fff', borderRadius: 12, border: '1px solid var(--borde, #e2e8ea)', padding: 16 };
  const inp = { width: '100%', padding: '10px 12px', border: '1px solid var(--borde, #e2e8ea)', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' };
  const lbl = { fontSize: 13, fontWeight: 600, color: 'var(--gris, #5f7177)', marginBottom: 2 };

  const TABS = [['inicio', 'Inicio'], ['identificar', 'Identificar'], ['historial', 'Historial'], ['retiros', 'Retiros'], ['perfil', 'Mi perfil']];

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
      <nav style={{ display: 'flex', gap: 0, background: '#fff', borderBottom: '1px solid var(--borde, #e2e8ea)', overflowX: 'auto' }}>
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => { setVista(k); setError(null); }} style={{ flex: '0 0 auto', padding: '12px 16px', border: 'none', borderBottom: vista === k ? '2px solid var(--verde, #0f766e)' : '2px solid transparent', background: 'none', fontWeight: vista === k ? 600 : 400, color: vista === k ? 'var(--verde, #0f766e)' : 'var(--gris, #5f7177)', cursor: 'pointer', fontSize: 14, whiteSpace: 'nowrap' }}>{label}</button>
        ))}
      </nav>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error && <p style={{ background: '#fef2f2', color: '#dc2626', padding: 12, borderRadius: 8, fontSize: 14, margin: 0 }}>{error}</p>}

        {/* ======== INICIO ======== */}
        {vista === 'inicio' && (
          <>
            {/* Stats cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[
                [stats?.identificaciones ?? 0, 'Identificaciones'],
                [`${fmtKg(stats?.pesoKg)} kg`, 'Kg reciclables'],
                [`${fmtKg(stats?.co2Kg)} kg`, 'CO₂ evitado'],
              ].map(([v, l]) => (
                <div key={l} style={{ ...card, textAlign: 'center', padding: 16 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--verde, #0f766e)' }}>{v}</div>
                  <div style={{ fontSize: 12, color: 'var(--gris)', marginTop: 4 }}>{l}</div>
                </div>
              ))}
            </div>

            {/* Retiros stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ ...card, textAlign: 'center', padding: 16 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--verde)' }}>{stats?.retiros ?? 0}</div>
                <div style={{ fontSize: 12, color: 'var(--gris)', marginTop: 4 }}>Retiros solicitados</div>
              </div>
              <div style={{ ...card, textAlign: 'center', padding: 16 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--verde)' }}>{stats?.retirosCompletados ?? 0}</div>
                <div style={{ fontSize: 12, color: 'var(--gris)', marginTop: 4 }}>Retiros completados</div>
              </div>
            </div>

            {/* Quick actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={() => setVista('identificar')} style={{ ...btn, padding: 20, fontSize: 15, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 24 }}>📷</span>
                Identificar residuos
              </button>
              <button onClick={() => { setVista('retiros'); setCreandoRetiro(true); }} style={{ ...btnSec, padding: 20, fontSize: 15, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 24 }}>🚛</span>
                Solicitar retiro
              </button>
            </div>

            {/* Certificado */}
            {(stats?.identificaciones ?? 0) > 0 && (
              <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <b style={{ fontSize: 15 }}>Tu certificado de reciclaje</b>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--gris)' }}>Descargá un PDF con tu impacto ambiental</p>
                </div>
                <button onClick={descargarCertificado} style={{ ...btn, fontSize: 13 }}>Descargar PDF</button>
              </div>
            )}

            {/* Guía preview */}
            <div style={{ ...card, cursor: 'pointer' }} onClick={() => setVista('guia')}>
              <b>♻️ Guía de reciclaje</b>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--gris)' }}>Consultá dónde va cada tipo de residuo</p>
            </div>
          </>
        )}

        {/* ======== IDENTIFICAR ======== */}
        {vista === 'identificar' && (
          <>
            {!preview && (
              <div style={{ border: '2px dashed var(--borde, #e2e8ea)', borderRadius: 12, padding: 32, textAlign: 'center', background: '#fff' }}>
                <p style={{ fontSize: 15, marginBottom: 12 }}>Sacale una foto a tus residuos</p>
                <label style={{ display: 'inline-block', ...btn, padding: '12px 24px', cursor: 'pointer' }}>
                  Abrir cámara
                  <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFoto} style={{ display: 'none' }} />
                </label>
                <p style={{ fontSize: 12, color: 'var(--gris, #5f7177)', marginTop: 8 }}>También podés elegir una foto de la galería</p>
              </div>
            )}

            {preview && (
              <div style={{ ...card, overflow: 'hidden', padding: 0 }}>
                <img src={preview} alt="Foto" style={{ width: '100%', maxHeight: 300, objectFit: 'cover' }} />
                <div style={{ padding: 16, display: 'flex', gap: 8 }}>
                  {!resultado && (
                    <>
                      <button onClick={analizar} disabled={analizando} style={{ flex: 1, ...btn }}>{analizando ? 'Analizando…' : 'Identificar residuos'}</button>
                      <button onClick={limpiarFoto} style={btnSec}>✕</button>
                    </>
                  )}
                  {resultado && <button onClick={limpiarFoto} style={{ flex: 1, ...btn }}>Nueva foto</button>}
                </div>
              </div>
            )}

            {resultado && (
              <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: 16 }}>Resultado del análisis</h3>
                  <span style={{ fontSize: 13, color: 'var(--gris)' }}>~{fmtKg(resultado.pesoEstimadoKg)} kg | CO₂ ~{fmtKg(resultado.co2EvitadoKg)} kg</span>
                </div>
                {resultado.items?.map((it, i) => (
                  <div key={i} style={{ padding: 12, borderRadius: 8, background: 'var(--fondo, #f5f7f8)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <b style={{ fontSize: 15 }}>{it.tipo || it.material}</b>
                      <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 20, background: it.reciclable ? '#dcfce7' : '#fef2f2', color: it.reciclable ? '#166534' : '#991b1b' }}>
                        {it.reciclable ? 'Reciclable' : 'No reciclable'}
                      </span>
                    </div>
                    {it.guia && (
                      <div style={{ padding: 8, borderRadius: 6, background: '#fff', border: '1px solid var(--borde)' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: CONTENEDOR_COLOR[it.guia.contenedor] || '#374151' }}>🗑️ {it.guia.contenedor}</span>
                        <p style={{ margin: '4px 0 0', fontSize: 13 }}>{it.guia.instruccion}</p>
                      </div>
                    )}
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
          </>
        )}

        {/* ======== HISTORIAL ======== */}
        {vista === 'historial' && (
          <>
            <h3 style={{ margin: 0 }}>Historial de identificaciones</h3>
            {historial.length === 0 && <p style={{ color: 'var(--gris)', fontSize: 14 }}>Todavía no identificaste residuos. Sacale una foto desde la pestaña "Identificar".</p>}
            {historial.map((h) => (
              <div key={h._id} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--gris)' }}>{fmtFecha(h.createdAt)}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>~{fmtKg(h.pesoEstimadoKg)} kg</span>
                    <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>CO₂ ~{fmtKg(h.co2EvitadoKg)} kg</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {h.items?.map((it, i) => (
                    <span key={i} style={{ background: it.reciclable ? '#f0fdf4' : '#fef2f2', color: it.reciclable ? '#166534' : '#991b1b', padding: '4px 10px', borderRadius: 20, fontSize: 13 }}>
                      {it.tipo || it.material}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {/* ======== RETIROS ======== */}
        {vista === 'retiros' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Retiros de reciclables</h3>
              {!creandoRetiro && <button onClick={() => setCreandoRetiro(true)} style={btn}>+ Solicitar retiro</button>}
            </div>

            {creandoRetiro && (
              <form onSubmit={crearRetiro} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h4 style={{ margin: 0 }}>Nuevo retiro</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={lbl}>Dirección *</label>
                  <input value={retiroForm.direccion} onChange={(e) => setRetiroForm({ ...retiroForm, direccion: e.target.value })} style={inp} placeholder="Calle y número" required />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={lbl}>Ciudad</label>
                    <input value={retiroForm.ciudad} onChange={(e) => setRetiroForm({ ...retiroForm, ciudad: e.target.value })} style={inp} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={lbl}>Fecha preferida</label>
                    <input type="date" value={retiroForm.fechaPreferida} onChange={(e) => setRetiroForm({ ...retiroForm, fechaPreferida: e.target.value })} style={inp} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={lbl}>Franja horaria</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {Object.entries(FRANJA).map(([k, l]) => (
                      <button key={k} type="button" onClick={() => setRetiroForm({ ...retiroForm, franjaHoraria: k })} style={{ ...retiroForm.franjaHoraria === k ? btn : btnSec, flex: 1, fontSize: 13, padding: '8px 4px' }}>{l}</button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={lbl}>¿Qué materiales tenés?</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {MATERIALES_RETIRO.map((m) => (
                      <button key={m} type="button" onClick={() => toggleMaterial(m)} style={{ padding: '6px 12px', borderRadius: 20, border: '1px solid var(--borde)', background: retiroForm.materiales.includes(m) ? 'var(--verde)' : '#fff', color: retiroForm.materiales.includes(m) ? '#fff' : 'var(--gris)', cursor: 'pointer', fontSize: 13 }}>{m}</button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={lbl}>Peso estimado (kg)</label>
                    <input type="number" step="0.5" min="0" value={retiroForm.pesoEstimadoKg} onChange={(e) => setRetiroForm({ ...retiroForm, pesoEstimadoKg: e.target.value })} style={inp} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={lbl}>Observaciones</label>
                    <input value={retiroForm.observaciones} onChange={(e) => setRetiroForm({ ...retiroForm, observaciones: e.target.value })} style={inp} placeholder="Timbre, piso, etc." />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" disabled={loading} style={btn}>{loading ? 'Enviando…' : 'Solicitar retiro'}</button>
                  <button type="button" onClick={() => setCreandoRetiro(false)} style={btnSec}>Cancelar</button>
                </div>
              </form>
            )}

            {retiros.length === 0 && !creandoRetiro && <p style={{ color: 'var(--gris)', fontSize: 14 }}>No tenés retiros solicitados.</p>}
            {retiros.map((r) => {
              const est = ESTADO_RETIRO[r.estado] ?? ESTADO_RETIRO.pendiente;
              return (
                <div key={r._id} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <b>{r.direccion}</b>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: est.bg, color: est.color }}>{est.label}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--gris)' }}>
                    {r.ciudad && <span>{r.ciudad} · </span>}
                    {r.fechaPreferida && <span>{fmtFecha(r.fechaPreferida)} · </span>}
                    <span>{FRANJA[r.franjaHoraria] ?? r.franjaHoraria}</span>
                    {r.pesoEstimadoKg > 0 && <span> · ~{fmtKg(r.pesoEstimadoKg)} kg</span>}
                  </div>
                  {r.materiales?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {r.materiales.map((m) => <span key={m} style={{ background: '#f0fdf4', padding: '2px 8px', borderRadius: 12, fontSize: 12, color: '#166534' }}>{m}</span>)}
                    </div>
                  )}
                  {r.estado === 'pendiente' && (
                    <button onClick={() => cancelarRetiro(r._id)} style={{ ...btnSec, alignSelf: 'flex-start', fontSize: 13, padding: '6px 12px', color: '#dc2626' }}>Cancelar</button>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* ======== MI PERFIL ======== */}
        {vista === 'perfil' && (
          <>
            <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--verde)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 24, fontWeight: 700 }}>
                {(user?.nombre ?? 'V')[0].toUpperCase()}
              </div>
              <div>
                <b style={{ fontSize: 18 }}>{user?.nombre ?? 'Vecino'}</b>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--gris)' }}>Vecino · Miembro desde {fmtFecha(user?.createdAt ?? new Date())}</p>
              </div>
            </div>

            <form onSubmit={guardarPerfil} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0 }}>Información personal</h4>
                {!editandoPerfil && <button type="button" onClick={() => setEditandoPerfil(true)} style={{ ...btnSec, fontSize: 13, padding: '6px 14px' }}>Editar</button>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  ['DNI', 'dni'], ['Teléfono', 'telefono'], ['Dirección', 'direccion'], ['Ciudad', 'ciudad'], ['Provincia', 'provincia'], ['Fecha de nacimiento', 'fechaNacimiento'],
                ].map(([label, key]) => (
                  <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={lbl}>{label}</label>
                    {editandoPerfil ? (
                      <input type={key === 'fechaNacimiento' ? 'date' : 'text'} value={perfil[key]} onChange={(e) => setPerfil({ ...perfil, [key]: e.target.value })} style={inp} />
                    ) : (
                      <span style={{ padding: '10px 12px', background: 'var(--fondo)', borderRadius: 8, fontSize: 14, minHeight: 20 }}>{perfil[key] || '-'}</span>
                    )}
                  </div>
                ))}
              </div>
              {editandoPerfil && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" disabled={loading} style={btn}>{loading ? 'Guardando…' : 'Guardar'}</button>
                  <button type="button" onClick={() => setEditandoPerfil(false)} style={btnSec}>Cancelar</button>
                </div>
              )}
            </form>

            {/* Certificado */}
            {(stats?.identificaciones ?? 0) > 0 && (
              <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <b>Certificado de reciclaje</b>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--gris)' }}>{stats.identificaciones} identificaciones · {fmtKg(stats.pesoKg)} kg · CO₂ {fmtKg(stats.co2Kg)} kg</p>
                </div>
                <button onClick={descargarCertificado} style={btn}>Descargar PDF</button>
              </div>
            )}
          </>
        )}

        {/* ======== GUÍA ======== */}
        {vista === 'guia' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Guía de reciclaje</h3>
              <button onClick={() => setVista('inicio')} style={{ ...btnSec, fontSize: 13, padding: '6px 14px' }}>Volver</button>
            </div>
            <p style={{ fontSize: 14, color: 'var(--gris)', margin: 0 }}>Referencia rápida para saber dónde va cada tipo de residuo.</p>
            {guia && Object.entries(guia).map(([tipo, info]) => (
              <div key={tipo} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <b style={{ fontSize: 15, textTransform: 'capitalize' }}>{tipo}</b>
                  <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 20, fontWeight: 600, color: '#fff', background: CONTENEDOR_COLOR[info.contenedor] || '#374151' }}>{info.contenedor}</span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--gris)' }}>{info.instruccion}</p>
              </div>
            ))}
          </>
        )}
      </main>
    </div>
  );
}
