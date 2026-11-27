import { useState, useEffect } from 'react';
import { api, getToken } from '../../api.js';

const BASE = import.meta.env.VITE_API_URL || '';

const TIPOS_ENVASE = [
  { value: 'pet', label: 'PET (1)' }, { value: 'pead', label: 'PEAD (2)' }, { value: 'pvc', label: 'PVC (3)' },
  { value: 'pebd', label: 'PEBD (4)' }, { value: 'pp', label: 'PP (5)' }, { value: 'ps', label: 'PS (6)' },
  { value: 'otros_plasticos', label: 'Otros plásticos (7)' },
  { value: 'carton_corrugado', label: 'Cartón corrugado' }, { value: 'carton_compacto', label: 'Cartón compacto' },
  { value: 'papel', label: 'Papel' }, { value: 'papel_diario', label: 'Papel diario' },
  { value: 'vidrio_transparente', label: 'Vidrio transparente' }, { value: 'vidrio_color', label: 'Vidrio color' },
  { value: 'aluminio', label: 'Aluminio' }, { value: 'hojalata', label: 'Hojalata' }, { value: 'acero', label: 'Acero' },
  { value: 'tetra_pak', label: 'Tetra Pak' }, { value: 'flexible_multicapa', label: 'Flexible multicapa' },
  { value: 'otro', label: 'Otro' },
];

const fmtKg = (n) => Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 1 });
const fmtFecha = (d) => d ? new Date(d).toLocaleDateString('es-AR') : '-';

const lineaVacia = () => ({ tipoEnvase: 'pet', descripcion: '', pesoKg: '', co2EvitadoKg: '' });

export default function EPR() {
  const [vista, setVista] = useState('reportes');
  const [reportes, setReportes] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Form nuevo reporte
  const [form, setForm] = useState({ marca: '', desde: '', hasta: '', observaciones: '' });
  const [lineas, setLineas] = useState([lineaVacia()]);

  // Form nueva marca
  const [marcaForm, setMarcaForm] = useState({ nombre: '', cuit: '', direccion: '' });
  const [editMarca, setEditMarca] = useState(null);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    try {
      const [r, m, s] = await Promise.all([api('/epr'), api('/epr/marcas'), api('/epr/stats')]);
      setReportes(r.items ?? []);
      setMarcas(m.items ?? []);
      setStats(s);
    } catch {}
  }

  // ---- Marcas ----
  async function guardarMarca(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (editMarca) {
        await api(`/epr/marcas/${editMarca}`, { method: 'PATCH', body: JSON.stringify(marcaForm), headers: { 'Content-Type': 'application/json' } });
      } else {
        await api('/epr/marcas', { method: 'POST', body: JSON.stringify(marcaForm), headers: { 'Content-Type': 'application/json' } });
      }
      setMarcaForm({ nombre: '', cuit: '', direccion: '' });
      setEditMarca(null);
      await cargar();
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  async function eliminarMarca(id) {
    if (!confirm('¿Desactivar esta marca?')) return;
    try { await api(`/epr/marcas/${id}`, { method: 'DELETE' }); await cargar(); } catch {}
  }

  // ---- Reportes ----
  function setLinea(i, k, v) { setLineas((ls) => ls.map((l, j) => j === i ? { ...l, [k]: v } : l)); }

  async function guardarReporte(e) {
    e.preventDefault();
    setError(null);
    if (!form.marca) { setError('Seleccioná una marca'); return; }
    if (!lineas.some((l) => l.pesoKg > 0)) { setError('Agregá al menos una línea con peso'); return; }
    setLoading(true);
    try {
      await api('/epr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          lineas: lineas.filter((l) => l.pesoKg > 0).map((l) => ({ ...l, pesoKg: Number(l.pesoKg), co2EvitadoKg: l.co2EvitadoKg ? Number(l.co2EvitadoKg) : undefined })),
        }),
      });
      setForm({ marca: '', desde: '', hasta: '', observaciones: '' });
      setLineas([lineaVacia()]);
      setVista('reportes');
      await cargar();
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  async function descargarPdf(id, numero) {
    try {
      const token = getToken();
      const res = await fetch(`${BASE}/api/epr/${id}/pdf`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Error al generar el PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte-epr-${String(numero).padStart(6, '0')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { setError(err.message); }
  }

  async function eliminarReporte(id) {
    if (!confirm('¿Eliminar este reporte?')) return;
    try { await api(`/epr/${id}`, { method: 'DELETE' }); await cargar(); } catch {}
  }

  const btn = { background: 'var(--verde, #0f766e)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 14 };
  const btnSec = { ...btn, background: '#fff', color: 'var(--verde, #0f766e)', border: '1px solid var(--borde, #e2e8ea)' };
  const card = { background: '#fff', borderRadius: 12, border: '1px solid var(--borde, #e2e8ea)', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 };
  const inp = { width: '100%', padding: '10px 12px', border: '1px solid var(--borde, #e2e8ea)', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' };
  const label = { fontSize: 13, fontWeight: 600, color: 'var(--gris, #5f7177)', marginBottom: 2 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>EPR — Responsabilidad Extendida del Productor</h2>
      </div>

      {/* Tabs */}
      <nav style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--borde, #e2e8ea)' }}>
        {[['reportes', 'Reportes'], ['nuevo', '+ Nuevo reporte'], ['marcas', 'Marcas'], ['estadisticas', 'Estadísticas']].map(([k, l]) => (
          <button key={k} onClick={() => setVista(k)} style={{ padding: '10px 18px', border: 'none', borderBottom: vista === k ? '2px solid var(--verde)' : '2px solid transparent', background: 'none', fontWeight: vista === k ? 600 : 400, color: vista === k ? 'var(--verde)' : 'var(--gris)', cursor: 'pointer', fontSize: 14 }}>{l}</button>
        ))}
      </nav>

      {error && <p style={{ background: '#fef2f2', color: '#dc2626', padding: 12, borderRadius: 8, fontSize: 14, margin: 0 }}>{error}</p>}

      {/* ---- REPORTES ---- */}
      {vista === 'reportes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {reportes.length === 0 && <p style={{ color: 'var(--gris)', fontSize: 14 }}>No hay reportes EPR todavía. Creá uno desde la pestaña "+ Nuevo reporte".</p>}
          {reportes.map((r) => (
            <div key={r._id} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <span style={{ fontSize: 13, color: 'var(--gris)' }}>N° {r.numero}</span>
                  <h3 style={{ margin: 0, fontSize: 16 }}>{r.marca?.nombre ?? r.marcaSnapshot?.nombre ?? '-'}</h3>
                  <span style={{ fontSize: 13, color: 'var(--gris)' }}>{fmtFecha(r.periodo?.desde)} — {fmtFecha(r.periodo?.hasta)}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>{fmtKg(r.totalKg)} kg</span>
                  <span style={{ background: '#dbeafe', color: '#1e40af', padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>CO₂ {fmtKg(r.co2EvitadoKg)} kg</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => descargarPdf(r._id, r.numero)} style={{ ...btn, fontSize: 13, padding: '6px 14px' }}>Descargar PDF</button>
                <button onClick={() => eliminarReporte(r._id)} style={{ ...btnSec, fontSize: 13, padding: '6px 14px', color: '#dc2626' }}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---- NUEVO REPORTE ---- */}
      {vista === 'nuevo' && (
        <form onSubmit={guardarReporte} style={card}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={label}>Marca / Productor *</label>
              <select value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} style={inp} required>
                <option value="">Seleccionar marca…</option>
                {marcas.map((m) => <option key={m._id} value={m._id}>{m.nombre}</option>)}
              </select>
              {marcas.length === 0 && <span style={{ fontSize: 12, color: '#dc2626' }}>Primero creá una marca en la pestaña "Marcas"</span>}
            </div>
            <div />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={label}>Período desde *</label>
              <input type="date" value={form.desde} onChange={(e) => setForm({ ...form, desde: e.target.value })} style={inp} required />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={label}>Período hasta *</label>
              <input type="date" value={form.hasta} onChange={(e) => setForm({ ...form, hasta: e.target.value })} style={inp} required />
            </div>
          </div>

          <h4 style={{ margin: '8px 0 0' }}>Materiales recuperados</h4>
          {lineas.map((l, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px 100px auto', gap: 8, alignItems: 'end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {i === 0 && <label style={label}>Tipo de envase</label>}
                <select value={l.tipoEnvase} onChange={(e) => setLinea(i, 'tipoEnvase', e.target.value)} style={inp}>
                  {TIPOS_ENVASE.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {i === 0 && <label style={label}>Descripción</label>}
                <input value={l.descripcion} onChange={(e) => setLinea(i, 'descripcion', e.target.value)} placeholder="Ej: botella 500ml" style={inp} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {i === 0 && <label style={label}>Peso (kg)</label>}
                <input type="number" step="0.1" min="0" value={l.pesoKg} onChange={(e) => setLinea(i, 'pesoKg', e.target.value)} style={inp} required />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {i === 0 && <label style={label}>CO₂ evitado</label>}
                <input type="number" step="0.1" min="0" value={l.co2EvitadoKg} onChange={(e) => setLinea(i, 'co2EvitadoKg', e.target.value)} style={inp} />
              </div>
              <button type="button" onClick={() => setLineas((ls) => ls.filter((_, j) => j !== i))} style={{ ...btnSec, padding: '8px 12px', color: '#dc2626', visibility: lineas.length > 1 ? 'visible' : 'hidden' }}>✕</button>
            </div>
          ))}
          <button type="button" onClick={() => setLineas([...lineas, lineaVacia()])} style={{ ...btnSec, alignSelf: 'flex-start', fontSize: 13 }}>+ Agregar línea</button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={label}>Observaciones</label>
            <textarea value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} style={{ ...inp, minHeight: 60 }} />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={loading} style={btn}>{loading ? 'Guardando…' : 'Crear reporte EPR'}</button>
            <button type="button" onClick={() => setVista('reportes')} style={btnSec}>Cancelar</button>
          </div>
        </form>
      )}

      {/* ---- MARCAS ---- */}
      {vista === 'marcas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <form onSubmit={guardarMarca} style={{ ...card, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'end', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 180px' }}>
              <label style={label}>Nombre *</label>
              <input value={marcaForm.nombre} onChange={(e) => setMarcaForm({ ...marcaForm, nombre: e.target.value })} style={inp} required />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 140px' }}>
              <label style={label}>CUIT</label>
              <input value={marcaForm.cuit} onChange={(e) => setMarcaForm({ ...marcaForm, cuit: e.target.value })} style={inp} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 200px' }}>
              <label style={label}>Dirección</label>
              <input value={marcaForm.direccion} onChange={(e) => setMarcaForm({ ...marcaForm, direccion: e.target.value })} style={inp} />
            </div>
            <button type="submit" disabled={loading} style={btn}>{editMarca ? 'Actualizar' : 'Agregar marca'}</button>
            {editMarca && <button type="button" onClick={() => { setEditMarca(null); setMarcaForm({ nombre: '', cuit: '', direccion: '' }); }} style={btnSec}>Cancelar</button>}
          </form>

          {marcas.length === 0 && <p style={{ color: 'var(--gris)', fontSize: 14 }}>No hay marcas cargadas. Agregá la primera arriba.</p>}
          {marcas.map((m) => (
            <div key={m._id} style={{ ...card, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px' }}>
              <div>
                <b>{m.nombre}</b>
                {m.cuit && <span style={{ marginLeft: 12, fontSize: 13, color: 'var(--gris)' }}>CUIT: {m.cuit}</span>}
                {m.direccion && <span style={{ marginLeft: 12, fontSize: 13, color: 'var(--gris)' }}>{m.direccion}</span>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => { setEditMarca(m._id); setMarcaForm({ nombre: m.nombre, cuit: m.cuit ?? '', direccion: m.direccion ?? '' }); setVista('marcas'); }} style={{ ...btnSec, fontSize: 13, padding: '6px 12px' }}>Editar</button>
                <button onClick={() => eliminarMarca(m._id)} style={{ ...btnSec, fontSize: 13, padding: '6px 12px', color: '#dc2626' }}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---- ESTADÍSTICAS ---- */}
      {vista === 'estadisticas' && stats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {[
              ['Total reportes', stats.total],
              ['Material recuperado', `${fmtKg(stats.totalKg)} kg`],
              ['CO₂ evitado', `${fmtKg(stats.totalCo2)} kg`],
            ].map(([t, v]) => (
              <div key={t} style={{ ...card, alignItems: 'center', padding: 20 }}>
                <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--verde)' }}>{v}</span>
                <span style={{ fontSize: 13, color: 'var(--gris)' }}>{t}</span>
              </div>
            ))}
          </div>

          {Object.keys(stats.porMarca ?? {}).length > 0 && (
            <div style={card}>
              <h4 style={{ margin: 0 }}>Recuperación por marca</h4>
              {Object.entries(stats.porMarca).sort((a, b) => b[1] - a[1]).map(([nombre, kg]) => (
                <div key={nombre} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--borde)' }}>
                  <span>{nombre}</span>
                  <span style={{ fontWeight: 600 }}>{fmtKg(kg)} kg</span>
                </div>
              ))}
            </div>
          )}

          {Object.keys(stats.porTipo ?? {}).length > 0 && (
            <div style={card}>
              <h4 style={{ margin: 0 }}>Recuperación por tipo de envase</h4>
              {Object.entries(stats.porTipo).sort((a, b) => b[1] - a[1]).map(([tipo, kg]) => {
                const lbl = TIPOS_ENVASE.find((t) => t.value === tipo)?.label ?? tipo;
                return (
                  <div key={tipo} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--borde)' }}>
                    <span>{lbl}</span>
                    <span style={{ fontWeight: 600 }}>{fmtKg(kg)} kg</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
