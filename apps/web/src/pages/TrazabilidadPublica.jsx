import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

const BASE = import.meta.env.VITE_API_URL || '';
const fmtKg = (n) => Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 1 });
const fmtL = (n) => Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 });
const fmtFecha = (d) => d ? new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }) : '-';
const fmtFechaHora = (d) => d ? new Date(d).toLocaleString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

const ETAPA_LABELS = { generacion: 'Generación del residuo', recoleccion: 'Recolección', transporte: 'Transporte', recepcion: 'Recepción en planta', clasificacion: 'Clasificación', transformacion: 'Transformación', producto_final: 'Producto final certificado', entrega: 'Entrega al destinatario' };
const ETAPA_ICONOS = { generacion: '📋', recoleccion: '🚛', transporte: '🛣️', recepcion: '🏭', clasificacion: '🔍', transformacion: '♻️', producto_final: '✅', entrega: '📦' };
const ETAPA_COLORES = { generacion: '#6b7280', recoleccion: '#d97706', transporte: '#2563eb', recepcion: '#7c3aed', clasificacion: '#0891b2', transformacion: '#0f766e', producto_final: '#16a34a', entrega: '#4f46e5' };

export default function TrazabilidadPublica() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [seccion, setSeccion] = useState('impacto');

  useEffect(() => {
    fetch(`${BASE}/api/public/trazabilidad/${token}`)
      .then((r) => { if (!r.ok) throw new Error('Producto no encontrado'); return r.json(); })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f7f8' }}><p>Cargando trazabilidad...</p></div>;
  if (error) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f7f8' }}><p style={{ color: '#dc2626' }}>{error}</p></div>;
  if (!data) return null;

  const SECCIONES = [['impacto', 'Impacto'], ['cadena', 'Cadena de custodia'], ['materiales', 'Materiales']];

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7f8' }}>
      {/* Header */}
      <header style={{ background: '#0f766e', color: '#fff', padding: '24px 20px', textAlign: 'center' }}>
        <p style={{ margin: '0 0 4px', fontSize: 13, opacity: 0.8, letterSpacing: 0.5 }}>GESTIÓN RSU — TRAZABILIDAD VERIFICADA</p>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>{data.nombre}</h1>
        {data.descripcion && <p style={{ margin: '8px 0 0', fontSize: 14, opacity: 0.9 }}>{data.descripcion}</p>}
        {data.certificadoPorNombre && (
          <div style={{ marginTop: 10, padding: '6px 14px', background: 'rgba(255,255,255,0.15)', borderRadius: 20, display: 'inline-block', fontSize: 13 }}>
            Certificado por {data.certificadoPorNombre} · {fmtFecha(data.fechaCertificacion)}
          </div>
        )}
      </header>

      <main style={{ maxWidth: 500, margin: '0 auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Cooperativa */}
        {data.cooperativa && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8ea', padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#0f766e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, fontWeight: 700 }}>♻️</div>
            <div>
              <b style={{ fontSize: 15 }}>{data.cooperativa.nombre}</b>
              {data.cooperativa.cuit && <p style={{ margin: 0, fontSize: 13, color: '#5f7177' }}>CUIT: {data.cooperativa.cuit}</p>}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, background: '#fff', borderRadius: 10, border: '1px solid #e2e8ea', overflow: 'hidden' }}>
          {SECCIONES.map(([k, label]) => (
            <button key={k} onClick={() => setSeccion(k)} style={{ flex: 1, padding: '10px 8px', border: 'none', borderBottom: seccion === k ? '2px solid #0f766e' : '2px solid transparent', background: 'none', fontWeight: seccion === k ? 600 : 400, color: seccion === k ? '#0f766e' : '#5f7177', cursor: 'pointer', fontSize: 13 }}>{label}</button>
          ))}
        </div>

        {/* ---- IMPACTO ---- */}
        {seccion === 'impacto' && (
          <>
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8ea', padding: 16 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Impacto ambiental de este producto</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                <div style={{ background: '#f0fdf4', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#0f766e' }}>{fmtKg(data.pesoTotalKg)}</div>
                  <div style={{ fontSize: 11, color: '#166534' }}>kg reciclados</div>
                </div>
                <div style={{ background: '#f0fdf4', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#0f766e' }}>{fmtKg(data.co2EvitadoKg)}</div>
                  <div style={{ fontSize: 11, color: '#166534' }}>kg CO₂ evitado</div>
                </div>
                <div style={{ background: '#eff6ff', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#1e40af' }}>{fmtL(data.aguaEvitadaL)}</div>
                  <div style={{ fontSize: 11, color: '#1e40af' }}>litros agua</div>
                </div>
              </div>
            </div>

            {/* Resumen de materiales */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8ea', padding: 16 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Composición del producto</h3>
              {data.lotes?.map((l, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < data.lotes.length - 1 ? '1px solid #e2e8ea' : 'none' }}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{l.material}</span>
                  <span style={{ fontSize: 14, color: '#5f7177' }}>{fmtKg(l.pesoKg)} kg</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ---- CADENA DE CUSTODIA ---- */}
        {seccion === 'cadena' && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8ea', padding: 16 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Cadena de custodia auditable</h3>
            <p style={{ fontSize: 13, color: '#5f7177', margin: '0 0 16px' }}>Registro verificable de cada paso del ciclo de vida del producto, desde la generación del residuo hasta la entrega final.</p>

            {(!data.cadena || data.cadena.length === 0) ? (
              <p style={{ fontSize: 13, color: '#9ca3af' }}>No hay eventos registrados aún.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {data.cadena.map((ev, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: i < data.cadena.length - 1 ? 20 : 0 }}>
                    {/* Timeline */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: ETAPA_COLORES[ev.etapa] ?? '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, flexShrink: 0 }}>
                        {ETAPA_ICONOS[ev.etapa] ?? '•'}
                      </div>
                      {i < data.cadena.length - 1 && <div style={{ flex: 1, width: 2, background: '#d1d5db', marginTop: 4 }} />}
                    </div>
                    {/* Content */}
                    <div style={{ flex: 1, paddingBottom: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 4 }}>
                        <b style={{ fontSize: 14, color: ETAPA_COLORES[ev.etapa] ?? '#374151' }}>{ETAPA_LABELS[ev.etapa] ?? ev.etapa}</b>
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>{fmtFechaHora(ev.fecha)}</span>
                      </div>
                      {ev.observaciones && <p style={{ margin: '2px 0 0', fontSize: 13, color: '#374151' }}>{ev.observaciones}</p>}
                      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                        {ev.responsableNombre && <span>Registrado por {ev.responsableNombre}</span>}
                        {ev.materialLabel && <span> · {ev.materialLabel}{ev.pesoKg ? ` (${fmtKg(ev.pesoKg)} kg)` : ''}</span>}
                        {ev.ubicacion?.direccion && <span> · {ev.ubicacion.direccion}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ---- MATERIALES ---- */}
        {seccion === 'materiales' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.lotes?.map((l, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8ea', padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <b style={{ fontSize: 15 }}>{l.material}</b>
                  <span style={{ fontSize: 14, color: '#0f766e', fontWeight: 600 }}>{fmtKg(l.pesoKg)} kg</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: 13 }}>
                  <div style={{ color: '#5f7177' }}>Origen: <b style={{ color: '#0f172a' }}>{l.origen}{l.origenDetalle ? ` — ${l.origenDetalle}` : ''}</b></div>
                  <div style={{ color: '#5f7177' }}>Recolección: <b style={{ color: '#0f172a' }}>{fmtFecha(l.fechaRecoleccion)}</b></div>
                  {l.generador?.nombre && <div style={{ color: '#5f7177' }}>Generador: <b style={{ color: '#0f172a' }}>{l.generador.nombre}</b></div>}
                  {l.transportista?.nombre && <div style={{ color: '#5f7177' }}>Transporte: <b style={{ color: '#0f172a' }}>{l.transportista.nombre}{l.transportista.patente ? ` (${l.transportista.patente})` : ''}</b></div>}
                  {l.fechaRecepcion && <div style={{ color: '#5f7177' }}>Recepción: <b style={{ color: '#0f172a' }}>{fmtFecha(l.fechaRecepcion)}</b></div>}
                  {l.procesoTransformacion && <div style={{ color: '#5f7177' }}>Transformación: <b style={{ color: '#0f172a' }}>{l.procesoTransformacion}</b></div>}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                  <div style={{ background: '#f0fdf4', borderRadius: 6, padding: 8, textAlign: 'center' }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#0f766e' }}>{fmtKg(l.co2EvitadoKg)} kg</span>
                    <div style={{ fontSize: 11, color: '#166534' }}>CO₂ evitado</div>
                  </div>
                  <div style={{ background: '#eff6ff', borderRadius: 6, padding: 8, textAlign: 'center' }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#1e40af' }}>{fmtL(l.aguaEvitadaL)} L</span>
                    <div style={{ fontSize: 11, color: '#1e40af' }}>Agua evitada</div>
                  </div>
                </div>

                {/* Eventos del lote */}
                {l.eventos?.length > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #e2e8ea' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#5f7177' }}>Registro de custodia:</span>
                    {l.eventos.map((ev, j) => (
                      <div key={j} style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 13 }}>
                        <span>{ETAPA_ICONOS[ev.etapa] ?? '•'}</span>
                        <div>
                          <b style={{ color: ETAPA_COLORES[ev.etapa] ?? '#374151' }}>{ETAPA_LABELS[ev.etapa] ?? ev.etapa}</b>
                          <span style={{ color: '#9ca3af' }}> — {fmtFechaHora(ev.fecha)}</span>
                          {ev.responsableNombre && <span style={{ color: '#9ca3af' }}> · {ev.responsableNombre}</span>}
                          {ev.observaciones && <p style={{ margin: '2px 0 0', color: '#5f7177', fontSize: 12 }}>{ev.observaciones}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '12px 0 24px', fontSize: 12, color: '#9ca3af' }}>
          <p style={{ margin: 0 }}>Producto creado el {fmtFecha(data.fechaCreacion)}</p>
          {data.fechaEntrega && <p style={{ margin: '4px 0 0' }}>Entregado el {fmtFecha(data.fechaEntrega)}</p>}
          <p style={{ margin: '8px 0 0' }}>Verificado por <b>Gestión RSU</b> — gestionrsu.com</p>
          <p style={{ margin: '4px 0 0', fontSize: 11 }}>Los valores de CO₂ y agua evitados son estimaciones basadas en factores EPA WARM y Water Footprint Network.</p>
          <p style={{ margin: '4px 0 0', fontSize: 11 }}>La cadena de custodia sigue el marco de trazabilidad de residuos con registro auditable de cada etapa.</p>
        </div>
      </main>
    </div>
  );
}
