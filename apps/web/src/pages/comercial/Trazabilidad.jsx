import { useState, useEffect } from 'react';
import { api, getToken } from '../../api.js';

const BASE = import.meta.env.VITE_API_URL || '';

const CATEGORIAS = { ecoladrillo: 'Ecoladrillo', maceta: 'Maceta', bloque: 'Bloque', compost: 'Compost', mobiliario: 'Mobiliario', textil: 'Textil', otro: 'Otro' };
const ESTADOS = { en_produccion: { label: 'En producción', bg: '#fef3c7', color: '#92400e' }, disponible: { label: 'Disponible', bg: '#dcfce7', color: '#166534' }, entregado: { label: 'Entregado', bg: '#dbeafe', color: '#1e40af' } };
const ORIGENES = { recoleccion_domiciliaria: 'Recolección domiciliaria', punto_verde: 'Punto verde', gran_generador: 'Gran generador', recolector_urbano: 'Recolector urbano', otro: 'Otro' };
const ETAPA_LABELS = { generacion: 'Generación', recoleccion: 'Recolección', transporte: 'Transporte', recepcion: 'Recepción', clasificacion: 'Clasificación', transformacion: 'Transformación', producto_final: 'Producto final', entrega: 'Entrega' };
const ETAPA_ICONOS = { generacion: '📋', recoleccion: '🚛', transporte: '🛣️', recepcion: '🏭', clasificacion: '🔍', transformacion: '♻️', producto_final: '✅', entrega: '📦' };
const fmtKg = (n) => Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 1 });
const fmtL = (n) => Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 });
const fmtFecha = (d) => d ? new Date(d).toLocaleDateString('es-AR') : '-';
const fmtFechaHora = (d) => d ? new Date(d).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

export default function Trazabilidad() {
  const [vista, setVista] = useState('lista');
  const [productos, setProductos] = useState([]);
  const [factores, setFactores] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Nuevo producto
  const loteVacio = { tipo: '', pesoKg: '', origenTipo: 'recoleccion_domiciliaria', origenDetalle: '', generadorNombre: '', generadorCuit: '', generadorDireccion: '', transportistaNombre: '', transportistaPatente: '', procesoTransformacion: '' };
  const [form, setForm] = useState({ nombre: '', descripcion: '', categoria: 'otro' });
  const [lotes, setLotes] = useState([{ ...loteVacio }]);

  // Detalle + auditoría
  const [detalle, setDetalle] = useState(null);
  const [auditoria, setAuditoria] = useState(null);

  // QR modal
  const [qrData, setQrData] = useState(null);

  // Calculadora
  const [calcMateriales, setCalcMateriales] = useState([{ tipo: '', pesoKg: '' }]);
  const [calcResultado, setCalcResultado] = useState(null);

  // Nuevo evento
  const [eventoForm, setEventoForm] = useState(null);

  useEffect(() => {
    cargar();
    api('/trazabilidad/factores/lista').then(setFactores).catch(() => {});
  }, []);

  async function cargar() {
    try { const r = await api('/trazabilidad'); setProductos(r.items ?? []); } catch {}
  }

  const tiposMaterial = Object.keys(factores);

  // ---- Crear producto ----
  function addLote() { setLotes([...lotes, { ...loteVacio }]); }
  function removeLote(i) { setLotes(lotes.filter((_, j) => j !== i)); }
  function updateLote(i, field, val) { setLotes(lotes.map((l, j) => j === i ? { ...l, [field]: val } : l)); }

  async function crearProducto(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const lotesValidos = lotes.filter((l) => l.tipo && l.pesoKg > 0).map((l) => ({
        tipo: l.tipo, pesoKg: Number(l.pesoKg), origenTipo: l.origenTipo, origenDetalle: l.origenDetalle || undefined,
        generador: (l.generadorNombre || l.generadorCuit) ? { nombre: l.generadorNombre, cuit: l.generadorCuit, direccion: l.generadorDireccion } : undefined,
        transportista: l.transportistaNombre ? { nombre: l.transportistaNombre, patente: l.transportistaPatente } : undefined,
        procesoTransformacion: l.procesoTransformacion || undefined,
      }));
      await api('/trazabilidad', { method: 'POST', body: JSON.stringify({ ...form, lotes: lotesValidos }), headers: { 'Content-Type': 'application/json' } });
      setForm({ nombre: '', descripcion: '', categoria: 'otro' });
      setLotes([{ ...loteVacio }]);
      setVista('lista');
      await cargar();
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  // ---- Detalle + auditoría ----
  async function verDetalle(id) {
    try {
      const [prod, aud] = await Promise.all([api(`/trazabilidad/${id}`), api(`/trazabilidad/${id}/auditoria`)]);
      setDetalle(prod);
      setAuditoria(aud);
      setVista('detalle');
    } catch {}
  }

  // ---- Registrar evento de auditoría ----
  async function registrarEvento(e) {
    e.preventDefault();
    if (!eventoForm) return;
    setLoading(true);
    try {
      const { productoId, loteId, ...data } = eventoForm;
      const url = loteId ? `/trazabilidad/${productoId}/lotes/${loteId}/eventos` : `/trazabilidad/${productoId}/eventos`;
      await api(url, { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } });
      setEventoForm(null);
      await verDetalle(productoId);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  // ---- QR ----
  async function verQR(id) {
    try {
      const token = getToken();
      const res = await fetch(`${BASE}/api/trazabilidad/${id}/qr`, { headers: { Authorization: `Bearer ${token}` } });
      setQrData(await res.json());
    } catch {}
  }

  // ---- Estado ----
  async function cambiarEstado(id, estado) {
    try {
      await api(`/trazabilidad/${id}/estado`, { method: 'PATCH', body: JSON.stringify({ estado }), headers: { 'Content-Type': 'application/json' } });
      await cargar();
      if (detalle?._id === id) await verDetalle(id);
    } catch {}
  }

  // ---- Calculadora ----
  async function calcular(e) {
    e.preventDefault();
    try {
      const mats = calcMateriales.filter((m) => m.tipo && m.pesoKg > 0).map((m) => ({ tipo: m.tipo, pesoKg: Number(m.pesoKg) }));
      if (!mats.length) return;
      setCalcResultado(await api('/trazabilidad/calcular-huella', { method: 'POST', body: JSON.stringify(mats), headers: { 'Content-Type': 'application/json' } }));
    } catch (err) { setError(err.message); }
  }

  const btn = { background: 'var(--verde, #0f766e)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 14 };
  const btnSec = { ...btn, background: '#fff', color: 'var(--verde, #0f766e)', border: '1px solid var(--borde, #e2e8ea)' };
  const btnDanger = { ...btnSec, color: '#dc2626', borderColor: '#fecaca' };
  const card = { background: '#fff', borderRadius: 12, border: '1px solid var(--borde, #e2e8ea)', padding: 16 };
  const inp = { width: '100%', padding: '10px 12px', border: '1px solid var(--borde, #e2e8ea)', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' };
  const lbl = { fontSize: 13, fontWeight: 600, color: 'var(--gris, #5f7177)', marginBottom: 2, display: 'block' };

  const TABS = [['lista', 'Productos'], ['nuevo', '+ Nuevo producto'], ['calculadora', 'Calculadora']];
  if (detalle) TABS.push(['detalle', 'Detalle: ' + (detalle.nombre ?? '')]);

  return (
    <>
      <nav style={{ display: 'flex', gap: 0, background: '#fff', borderBottom: '1px solid var(--borde, #e2e8ea)', overflowX: 'auto', marginBottom: 16 }}>
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => { setVista(k); setError(null); }} style={{ flex: '0 0 auto', padding: '12px 20px', border: 'none', borderBottom: vista === k ? '2px solid var(--verde, #0f766e)' : '2px solid transparent', background: 'none', fontWeight: vista === k ? 600 : 400, color: vista === k ? 'var(--verde, #0f766e)' : 'var(--gris, #5f7177)', cursor: 'pointer', fontSize: 14 }}>{label}</button>
        ))}
      </nav>

      {error && <p style={{ background: '#fef2f2', color: '#dc2626', padding: 12, borderRadius: 8, fontSize: 14, margin: '0 0 16px' }}>{error}</p>}

      {/* QR Modal */}
      {qrData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }} onClick={() => setQrData(null)}>
          <div style={{ ...card, padding: 32, maxWidth: 400, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px' }}>QR de trazabilidad</h3>
            <p style={{ fontSize: 13, color: 'var(--gris)', margin: '0 0 16px', wordBreak: 'break-all' }}>{qrData.url}</p>
            <img src={qrData.qr} alt="QR" style={{ width: 280, height: 280 }} />
            <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'center' }}>
              <a href={qrData.qr} download="qr-trazabilidad.png" style={{ ...btn, textDecoration: 'none', display: 'inline-block' }}>Descargar QR</a>
              <button onClick={() => setQrData(null)} style={btnSec}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Evento */}
      {eventoForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }} onClick={() => setEventoForm(null)}>
          <form onSubmit={registrarEvento} style={{ ...card, padding: 24, maxWidth: 460, width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px' }}>Registrar evento de auditoría</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={lbl}>Etapa *</label>
                <select value={eventoForm.etapa} onChange={(e) => setEventoForm({ ...eventoForm, etapa: e.target.value })} style={inp} required>
                  <option value="">Seleccionar...</option>
                  {Object.entries(ETAPA_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Fecha y hora</label>
                <input type="datetime-local" value={eventoForm.fecha ?? ''} onChange={(e) => setEventoForm({ ...eventoForm, fecha: e.target.value })} style={inp} />
              </div>
              <div>
                <label style={lbl}>Ubicación</label>
                <input value={eventoForm.ubicacionDir ?? ''} onChange={(e) => setEventoForm({ ...eventoForm, ubicacionDir: e.target.value })} style={inp} placeholder="Dirección, ciudad" />
              </div>
              <div>
                <label style={lbl}>Observaciones</label>
                <textarea value={eventoForm.observaciones ?? ''} onChange={(e) => setEventoForm({ ...eventoForm, observaciones: e.target.value })} style={{ ...inp, minHeight: 60 }} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setEventoForm(null)} style={btnSec}>Cancelar</button>
                <button type="submit" disabled={loading} style={btn}>{loading ? 'Registrando...' : 'Registrar'}</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ======== LISTA ======== */}
      {vista === 'lista' && (
        <>
          {productos.length === 0 && <p style={{ color: 'var(--gris)', fontSize: 14 }}>No hay productos cargados. Creá uno desde la pestaña "+ Nuevo producto".</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {productos.map((p) => {
              const est = ESTADOS[p.estado] ?? ESTADOS.en_produccion;
              return (
                <div key={p._id} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <b style={{ fontSize: 16, cursor: 'pointer', color: 'var(--verde)' }} onClick={() => verDetalle(p._id)}>{p.nombre}</b>
                      {p.descripcion && <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--gris)' }}>{p.descripcion}</p>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: est.bg, color: est.color }}>{est.label}</span>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, background: '#f0fdf4', color: '#166534' }}>{CATEGORIAS[p.categoria] ?? p.categoria}</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    <div style={{ background: 'var(--fondo, #f5f7f8)', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--verde)' }}>{fmtKg(p.pesoTotalKg)} kg</div>
                      <div style={{ fontSize: 11, color: 'var(--gris)' }}>Material reciclado</div>
                    </div>
                    <div style={{ background: 'var(--fondo, #f5f7f8)', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#0f766e' }}>{fmtKg(p.co2EvitadoKg)} kg</div>
                      <div style={{ fontSize: 11, color: 'var(--gris)' }}>CO₂ evitado</div>
                    </div>
                    <div style={{ background: 'var(--fondo, #f5f7f8)', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#1e40af' }}>{fmtL(p.aguaEvitadaL)} L</div>
                      <div style={{ fontSize: 11, color: 'var(--gris)' }}>Agua evitada</div>
                    </div>
                  </div>

                  {p.lotes?.length > 0 && (
                    <div style={{ fontSize: 13 }}>
                      <span style={{ fontWeight: 600, color: 'var(--gris)' }}>Materiales ({p.lotes.length}): </span>
                      {p.lotes.map((l, i) => (
                        <span key={i} style={{ display: 'inline-block', background: '#f0fdf4', padding: '2px 8px', borderRadius: 12, marginRight: 4, marginBottom: 4, color: '#166534' }}>
                          {factores[l.tipo]?.label ?? l.tipo} · {fmtKg(l.pesoKg)} kg
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button onClick={() => verDetalle(p._id)} style={{ ...btn, fontSize: 13, padding: '6px 14px' }}>Ver cadena de custodia</button>
                    <button onClick={() => verQR(p._id)} style={{ ...btnSec, fontSize: 13, padding: '6px 14px' }}>Ver QR</button>
                    {p.estado === 'en_produccion' && <button onClick={() => cambiarEstado(p._id, 'disponible')} style={{ ...btnSec, fontSize: 13, padding: '6px 14px' }}>Certificar disponible</button>}
                    {p.estado === 'disponible' && <button onClick={() => cambiarEstado(p._id, 'entregado')} style={{ ...btnSec, fontSize: 13, padding: '6px 14px' }}>Marcar entregado</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ======== DETALLE CON CADENA DE CUSTODIA ======== */}
      {vista === 'detalle' && detalle && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>{detalle.nombre}</h2>
              {detalle.descripcion && <p style={{ margin: 0, fontSize: 14, color: 'var(--gris)' }}>{detalle.descripcion}</p>}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => verQR(detalle._id)} style={{ ...btn, fontSize: 13, padding: '6px 14px' }}>Ver QR</button>
              <button onClick={() => setEventoForm({ productoId: detalle._id, etapa: '', observaciones: '' })} style={{ ...btnSec, fontSize: 13, padding: '6px 14px' }}>+ Evento</button>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {[
              { v: fmtKg(detalle.pesoTotalKg) + ' kg', l: 'Material reciclado', c: 'var(--verde)' },
              { v: fmtKg(detalle.co2EvitadoKg) + ' kg', l: 'CO₂ evitado', c: '#0f766e' },
              { v: fmtL(detalle.aguaEvitadaL) + ' L', l: 'Agua evitada', c: '#1e40af' },
              { v: detalle.lotes?.length ?? 0, l: 'Lotes de material', c: 'var(--tinta)' },
            ].map((s, i) => (
              <div key={i} style={{ background: 'var(--fondo, #f5f7f8)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.c }}>{s.v}</div>
                <div style={{ fontSize: 11, color: 'var(--gris)' }}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Certificación */}
          {detalle.certificadoPorNombre && (
            <div style={{ ...card, background: '#f0fdf4', borderColor: '#86efac' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>✅</span>
                <div>
                  <b style={{ fontSize: 14 }}>Certificado por {detalle.certificadoPorNombre}</b>
                  <p style={{ margin: 0, fontSize: 13, color: '#166534' }}>Fecha: {fmtFechaHora(detalle.fechaCertificacion)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Lotes con detalle */}
          <div style={card}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Lotes de material ({detalle.lotes?.length ?? 0})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {detalle.lotes?.map((l, i) => (
                <div key={l._id ?? i} style={{ background: 'var(--fondo, #f5f7f8)', borderRadius: 10, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <b style={{ fontSize: 15 }}>{factores[l.tipo]?.label ?? l.tipo} — {fmtKg(l.pesoKg)} kg</b>
                    <button onClick={() => setEventoForm({ productoId: detalle._id, loteId: l._id, etapa: '', observaciones: '' })} style={{ ...btnSec, fontSize: 12, padding: '4px 10px' }}>+ Evento</button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 13, color: 'var(--gris)' }}>
                    <span>Origen: <b style={{ color: 'var(--tinta)' }}>{ORIGENES[l.origenTipo] ?? l.origenTipo}</b>{l.origenDetalle ? ` — ${l.origenDetalle}` : ''}</span>
                    <span>Recolección: <b style={{ color: 'var(--tinta)' }}>{fmtFecha(l.fechaRecoleccion)}</b></span>
                    {l.generador?.nombre && <span>Generador: <b style={{ color: 'var(--tinta)' }}>{l.generador.nombre}</b>{l.generador.cuit ? ` (CUIT: ${l.generador.cuit})` : ''}</span>}
                    {l.transportista?.nombre && <span>Transportista: <b style={{ color: 'var(--tinta)' }}>{l.transportista.nombre}</b>{l.transportista.patente ? ` — ${l.transportista.patente}` : ''}</span>}
                    {l.fechaRecepcion && <span>Recepción: <b style={{ color: 'var(--tinta)' }}>{fmtFecha(l.fechaRecepcion)}</b></span>}
                    {l.procesoTransformacion && <span>Proceso: <b style={{ color: 'var(--tinta)' }}>{l.procesoTransformacion}</b></span>}
                    <span>CO₂ evitado: <b style={{ color: '#0f766e' }}>{fmtKg(l.co2EvitadoKg)} kg</b></span>
                    <span>Agua evitada: <b style={{ color: '#1e40af' }}>{fmtL(l.aguaEvitadaL)} L</b></span>
                  </div>

                  {/* Eventos del lote */}
                  {l.eventos?.length > 0 && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--borde)' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gris)' }}>Cadena de custodia del lote:</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                        {l.eventos.map((ev, j) => (
                          <div key={j} style={{ display: 'flex', gap: 8, fontSize: 13, alignItems: 'flex-start' }}>
                            <span style={{ flexShrink: 0 }}>{ETAPA_ICONOS[ev.etapa] ?? '•'}</span>
                            <div>
                              <b>{ETAPA_LABELS[ev.etapa] ?? ev.etapa}</b> — {fmtFechaHora(ev.fecha)}
                              {ev.responsableNombre && <span style={{ color: 'var(--gris)' }}> · {ev.responsableNombre}</span>}
                              {ev.observaciones && <p style={{ margin: '2px 0 0', color: 'var(--gris)', fontSize: 12 }}>{ev.observaciones}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Timeline de auditoría completa */}
          {auditoria?.eventos?.length > 0 && (
            <div style={card}>
              <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Historial de auditoría completo</h3>
              <p style={{ fontSize: 13, color: 'var(--gris)', margin: '0 0 12px' }}>Todos los eventos registrados en orden cronológico. Esta cadena es inmutable y auditable.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {auditoria.eventos.map((ev, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: i < auditoria.eventos.length - 1 ? 16 : 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 28 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: ev.contexto === 'producto' ? '#0f766e' : '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, flexShrink: 0 }}>
                        {ETAPA_ICONOS[ev.etapa] ?? '•'}
                      </div>
                      {i < auditoria.eventos.length - 1 && <div style={{ flex: 1, width: 2, background: '#d1d5db', marginTop: 4 }} />}
                    </div>
                    <div style={{ flex: 1, paddingBottom: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                        <b style={{ fontSize: 14 }}>{ETAPA_LABELS[ev.etapa] ?? ev.etapa}</b>
                        <span style={{ fontSize: 12, color: 'var(--gris)' }}>{fmtFechaHora(ev.fecha)}</span>
                      </div>
                      {ev.observaciones && <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--tinta)' }}>{ev.observaciones}</p>}
                      <div style={{ fontSize: 12, color: 'var(--gris)', marginTop: 2 }}>
                        {ev.responsableNombre && <span>Por: {ev.responsableNombre} · </span>}
                        <span style={{ padding: '1px 6px', borderRadius: 10, background: ev.contexto === 'producto' ? '#dcfce7' : '#e0e7ff', fontSize: 11 }}>
                          {ev.contexto === 'producto' ? 'Producto' : ev.materialLabel ?? 'Lote'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======== NUEVO PRODUCTO ======== */}
      {vista === 'nuevo' && (
        <form onSubmit={crearProducto} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h3 style={{ margin: 0 }}>Nuevo producto reciclado</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
            <div>
              <label style={lbl}>Nombre del producto *</label>
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} style={inp} placeholder="Ej: Maceta hexagonal 20cm" required />
            </div>
            <div>
              <label style={lbl}>Categoría</label>
              <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} style={inp}>
                {Object.entries(CATEGORIAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={lbl}>Descripción</label>
            <input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} style={inp} placeholder="Breve descripción del producto" />
          </div>

          <div style={{ borderTop: '1px solid var(--borde)', paddingTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <label style={{ ...lbl, margin: 0 }}>Materiales utilizados (cadena de custodia)</label>
              <button type="button" onClick={addLote} style={{ ...btnSec, fontSize: 12, padding: '4px 10px' }}>+ Agregar material</button>
            </div>
            {lotes.map((l, i) => (
              <div key={i} style={{ background: 'var(--fondo, #f5f7f8)', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: 8, marginBottom: 8 }}>
                  <div>
                    <label style={lbl}>Material *</label>
                    <select value={l.tipo} onChange={(e) => updateLote(i, 'tipo', e.target.value)} style={inp}>
                      <option value="">Seleccionar...</option>
                      {tiposMaterial.map((t) => <option key={t} value={t}>{factores[t]?.label ?? t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Peso (kg) *</label>
                    <input type="number" step="0.1" min="0" value={l.pesoKg} onChange={(e) => updateLote(i, 'pesoKg', e.target.value)} style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Origen</label>
                    <select value={l.origenTipo} onChange={(e) => updateLote(i, 'origenTipo', e.target.value)} style={inp}>
                      {Object.entries(ORIGENES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div>
                    <label style={lbl}>Generador (nombre)</label>
                    <input value={l.generadorNombre} onChange={(e) => updateLote(i, 'generadorNombre', e.target.value)} style={inp} placeholder="Nombre o razón social" />
                  </div>
                  <div>
                    <label style={lbl}>CUIT generador</label>
                    <input value={l.generadorCuit} onChange={(e) => updateLote(i, 'generadorCuit', e.target.value)} style={inp} placeholder="XX-XXXXXXXX-X" />
                  </div>
                  <div>
                    <label style={lbl}>Dirección generador</label>
                    <input value={l.generadorDireccion} onChange={(e) => updateLote(i, 'generadorDireccion', e.target.value)} style={inp} placeholder="Dirección" />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={lbl}>Transportista</label>
                    <input value={l.transportistaNombre} onChange={(e) => updateLote(i, 'transportistaNombre', e.target.value)} style={inp} placeholder="Nombre del transportista" />
                  </div>
                  <div>
                    <label style={lbl}>Patente vehículo</label>
                    <input value={l.transportistaPatente} onChange={(e) => updateLote(i, 'transportistaPatente', e.target.value)} style={inp} placeholder="ABC 123" />
                  </div>
                  <div>
                    <label style={lbl}>Proceso de transformación</label>
                    <input value={l.procesoTransformacion} onChange={(e) => updateLote(i, 'procesoTransformacion', e.target.value)} style={inp} placeholder="Enfardado, triturado..." />
                  </div>
                </div>
                {lotes.length > 1 && (
                  <div style={{ textAlign: 'right', marginTop: 8 }}>
                    <button type="button" onClick={() => removeLote(i)} style={{ ...btnDanger, fontSize: 12, padding: '4px 10px' }}>Quitar este material</button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <button type="submit" disabled={loading} style={btn}>{loading ? 'Creando…' : 'Crear producto con trazabilidad'}</button>
        </form>
      )}

      {/* ======== CALCULADORA ======== */}
      {vista === 'calculadora' && (
        <>
          <form onSubmit={calcular} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3 style={{ margin: 0 }}>Calculadora de huella ambiental</h3>
            <p style={{ fontSize: 13, color: 'var(--gris)', margin: 0 }}>Ingresá los materiales y su peso para calcular el CO₂ y agua evitados al reciclarlos vs producción virgen.</p>

            {calcMateriales.map((m, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 8, alignItems: 'end' }}>
                <div>
                  {i === 0 && <label style={lbl}>Material</label>}
                  <select value={m.tipo} onChange={(e) => setCalcMateriales(calcMateriales.map((x, j) => j === i ? { ...x, tipo: e.target.value } : x))} style={inp}>
                    <option value="">Seleccionar...</option>
                    {tiposMaterial.map((t) => <option key={t} value={t}>{factores[t]?.label ?? t}</option>)}
                  </select>
                </div>
                <div>
                  {i === 0 && <label style={lbl}>Peso (kg)</label>}
                  <input type="number" step="0.1" min="0" value={m.pesoKg} onChange={(e) => setCalcMateriales(calcMateriales.map((x, j) => j === i ? { ...x, pesoKg: e.target.value } : x))} style={inp} />
                </div>
                {calcMateriales.length > 1 && <button type="button" onClick={() => setCalcMateriales(calcMateriales.filter((_, j) => j !== i))} style={{ ...btnDanger, padding: '8px 10px' }}>✕</button>}
              </div>
            ))}

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setCalcMateriales([...calcMateriales, { tipo: '', pesoKg: '' }])} style={btnSec}>+ Material</button>
              <button type="submit" style={btn}>Calcular huella</button>
            </div>
          </form>

          {calcResultado && (
            <div style={{ ...card, marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h4 style={{ margin: 0 }}>Resultado</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: '#f0fdf4', borderRadius: 8, padding: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#0f766e' }}>{fmtKg(calcResultado.co2EvitadoKg)} kg</div>
                  <div style={{ fontSize: 13, color: '#166534' }}>CO₂ evitado</div>
                </div>
                <div style={{ background: '#eff6ff', borderRadius: 8, padding: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#1e40af' }}>{fmtL(calcResultado.aguaEvitadaL)} L</div>
                  <div style={{ fontSize: 13, color: '#1e40af' }}>Agua evitada</div>
                </div>
              </div>
              {calcResultado.detalle?.map((d, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--borde)', fontSize: 14 }}>
                  <span>{d.label} — {fmtKg(d.pesoKg)} kg</span>
                  <span style={{ color: 'var(--gris)' }}>CO₂ {fmtKg(d.co2EvitadoKg)} kg · Agua {fmtL(d.aguaEvitadaL)} L</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
