import { useState, useEffect } from 'react';
import { api, apiForm, fileUrl } from '../../api.js';

const TIPOS = [
  { value: 'notebook', label: 'Notebook' }, { value: 'desktop', label: 'Desktop' },
  { value: 'monitor', label: 'Monitor' }, { value: 'impresora', label: 'Impresora' },
  { value: 'telefono', label: 'Teléfono' }, { value: 'tablet', label: 'Tablet' },
  { value: 'servidor', label: 'Servidor' }, { value: 'switch_red', label: 'Switch de red' },
  { value: 'router', label: 'Router' }, { value: 'ups', label: 'UPS' },
  { value: 'otro', label: 'Otro' },
];

const ESTADOS = [
  { value: 'ingreso', label: 'Ingreso', color: '#6b7280' },
  { value: 'diagnostico', label: 'Diagnóstico', color: '#f59e0b' },
  { value: 'reparacion', label: 'Reparación', color: '#3b82f6' },
  { value: 'testing', label: 'Testing', color: '#8b5cf6' },
  { value: 'listo', label: 'Listo', color: '#22c55e' },
  { value: 'vendido', label: 'Vendido', color: '#0f766e' },
  { value: 'descarte', label: 'Descarte', color: '#dc2626' },
];

const estadoLabel = (v) => ESTADOS.find((e) => e.value === v) || { label: v, color: '#6b7280' };

export default function Reacondicionamiento() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [filtro, setFiltro] = useState('');
  const [vista, setVista] = useState('lista');
  const [detalle, setDetalle] = useState(null);
  const [form, setForm] = useState({ tipo: 'notebook', marca: '', modelo: '', numeroSerie: '', origenNombre: '', origenCuit: '', procesador: '', ram: '', almacenamiento: '', diagnosticoInicial: '', notas: '' });
  const [fotos, setFotos] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [intervForm, setIntervForm] = useState({ tipo: '', descripcion: '', piezas: '', costo: '', tecnico: '' });

  useEffect(() => { cargar(); }, [filtro]);

  async function cargar() {
    try {
      const [data, s] = await Promise.all([
        api(`/reacondicionamiento${filtro ? `?estado=${filtro}` : ''}`),
        api('/reacondicionamiento/stats'),
      ]);
      setItems(data.items ?? []);
      setStats(s);
    } catch {}
  }

  async function crear(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('datos', JSON.stringify(form));
      if (fotos) for (const f of fotos) fd.append('fotos', f);
      await apiForm('/reacondicionamiento', fd);
      setVista('lista');
      setForm({ tipo: 'notebook', marca: '', modelo: '', numeroSerie: '', origenNombre: '', origenCuit: '', procesador: '', ram: '', almacenamiento: '', diagnosticoInicial: '', notas: '' });
      setFotos(null);
      cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function cambiarEstado(id, estado) {
    try {
      await api(`/reacondicionamiento/${id}/estado`, { method: 'PATCH', body: { estado } });
      cargar();
      if (detalle?._id === id) verDetalle(id);
    } catch {}
  }

  async function agregarIntervencion(e) {
    e.preventDefault();
    if (!detalle) return;
    try {
      await api(`/reacondicionamiento/${detalle._id}/intervenciones`, {
        method: 'POST',
        body: { ...intervForm, costo: intervForm.costo ? Number(intervForm.costo) : undefined },
      });
      setIntervForm({ tipo: '', descripcion: '', piezas: '', costo: '', tecnico: '' });
      verDetalle(detalle._id);
      cargar();
    } catch {}
  }

  async function verDetalle(id) {
    try {
      const doc = await api(`/reacondicionamiento/${id}`);
      setDetalle(doc);
      setVista('detalle');
    } catch {}
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este equipo?')) return;
    try {
      await api(`/reacondicionamiento/${id}`, { method: 'DELETE' });
      setVista('lista');
      setDetalle(null);
      cargar();
    } catch {}
  }

  // ---- VISTA NUEVO ----
  if (vista === 'nuevo') {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Ingresar equipo</h2>
          <button className="secondary" onClick={() => setVista('lista')}>Volver</button>
        </div>
        <form className="card" onSubmit={crear} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <legend style={{ fontWeight: 600, marginBottom: 4 }}>Equipo</legend>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label>Tipo<select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>{TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
              <label>N° Serie *<input value={form.numeroSerie} onChange={(e) => setForm({ ...form, numeroSerie: e.target.value })} required /></label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label>Marca<input value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} /></label>
              <label>Modelo<input value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} /></label>
            </div>
          </fieldset>

          <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <legend style={{ fontWeight: 600, marginBottom: 4 }}>Origen</legend>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label>Nombre / Empresa<input value={form.origenNombre} onChange={(e) => setForm({ ...form, origenNombre: e.target.value })} /></label>
              <label>CUIT<input value={form.origenCuit} onChange={(e) => setForm({ ...form, origenCuit: e.target.value })} placeholder="30-12345678-9" /></label>
            </div>
          </fieldset>

          <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <legend style={{ fontWeight: 600, marginBottom: 4 }}>Especificaciones</legend>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <label>Procesador<input value={form.procesador} onChange={(e) => setForm({ ...form, procesador: e.target.value })} placeholder="Ej: i5-8250U" /></label>
              <label>RAM<input value={form.ram} onChange={(e) => setForm({ ...form, ram: e.target.value })} placeholder="Ej: 8 GB" /></label>
              <label>Almacenamiento<input value={form.almacenamiento} onChange={(e) => setForm({ ...form, almacenamiento: e.target.value })} placeholder="Ej: 256 GB SSD" /></label>
            </div>
          </fieldset>

          <label>Diagnóstico inicial<textarea value={form.diagnosticoInicial} onChange={(e) => setForm({ ...form, diagnosticoInicial: e.target.value })} rows={2} placeholder="Estado al ingresar, fallas detectadas..." /></label>
          <label>Fotos <span className="muted" style={{ fontWeight: 400 }}>(hasta 5)</span><input type="file" accept="image/*" multiple onChange={(e) => setFotos(e.target.files)} /></label>
          <label>Notas<textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} rows={2} /></label>

          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" disabled={loading || !form.numeroSerie.trim()}>{loading ? 'Guardando…' : 'Ingresar equipo'}</button>
        </form>
      </div>
    );
  }

  // ---- VISTA DETALLE ----
  if (vista === 'detalle' && detalle) {
    const est = estadoLabel(detalle.estado);
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>{detalle.marca} {detalle.modelo || TIPOS.find((t) => t.value === detalle.tipo)?.label}</h2>
          <button className="secondary" onClick={() => { setVista('lista'); setDetalle(null); }}>Volver</button>
        </div>

        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600, color: '#fff', background: est.color }}>{est.label}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {ESTADOS.filter((e) => e.value !== detalle.estado).map((e) => (
                <button key={e.value} className="secondary sm" onClick={() => cambiarEstado(detalle._id, e.value)} style={{ fontSize: 11 }}>{e.label}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 14 }}>
            <div><span className="muted">N° Serie:</span> <b>{detalle.numeroSerie}</b></div>
            <div><span className="muted">Tipo:</span> {TIPOS.find((t) => t.value === detalle.tipo)?.label}</div>
            {detalle.procesador && <div><span className="muted">CPU:</span> {detalle.procesador}</div>}
            {detalle.ram && <div><span className="muted">RAM:</span> {detalle.ram}</div>}
            {detalle.almacenamiento && <div><span className="muted">Disco:</span> {detalle.almacenamiento}</div>}
            {detalle.origenNombre && <div><span className="muted">Origen:</span> {detalle.origenNombre}</div>}
            <div><span className="muted">Ingreso:</span> {new Date(detalle.fechaIngreso).toLocaleDateString('es-AR')}</div>
            <div><span className="muted">Costo acum.:</span> ${detalle.costoTotal?.toLocaleString('es-AR') ?? 0}</div>
          </div>
          {detalle.diagnosticoInicial && <p style={{ marginTop: 8, fontSize: 13 }}><span className="muted">Diagnóstico:</span> {detalle.diagnosticoInicial}</p>}
          {detalle.fotos?.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {detalle.fotos.map((f, i) => <img key={i} src={fileUrl(f)} alt="" style={{ width: 100, height: 75, objectFit: 'cover', borderRadius: 6 }} />)}
            </div>
          )}
        </div>

        {/* Intervenciones */}
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 12px' }}>Intervenciones ({detalle.intervenciones?.length ?? 0})</h3>
          {(detalle.intervenciones ?? []).map((iv, i) => (
            <div key={iv._id ?? i} style={{ padding: 10, borderBottom: '1px solid var(--borde, #e2e8ea)', fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <b>{iv.tipo}</b>
                <span className="muted">{new Date(iv.fecha).toLocaleDateString('es-AR')}</span>
              </div>
              {iv.descripcion && <p style={{ margin: '4px 0 0' }}>{iv.descripcion}</p>}
              <div style={{ display: 'flex', gap: 16, marginTop: 4, color: 'var(--gris)' }}>
                {iv.piezas && <span>Piezas: {iv.piezas}</span>}
                {iv.costo != null && <span>Costo: ${iv.costo.toLocaleString('es-AR')}</span>}
                {iv.tecnico && <span>Técnico: {iv.tecnico}</span>}
              </div>
            </div>
          ))}

          <form onSubmit={agregarIntervencion} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12, padding: 12, background: 'var(--fondo, #f5f7f8)', borderRadius: 8 }}>
            <b style={{ fontSize: 13 }}>Agregar intervención</b>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label>Tipo *<input value={intervForm.tipo} onChange={(e) => setIntervForm({ ...intervForm, tipo: e.target.value })} required placeholder="Ej: Cambio de disco" /></label>
              <label>Técnico<input value={intervForm.tecnico} onChange={(e) => setIntervForm({ ...intervForm, tecnico: e.target.value })} /></label>
            </div>
            <label>Descripción<input value={intervForm.descripcion} onChange={(e) => setIntervForm({ ...intervForm, descripcion: e.target.value })} /></label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label>Piezas<input value={intervForm.piezas} onChange={(e) => setIntervForm({ ...intervForm, piezas: e.target.value })} placeholder="Ej: SSD 256GB Kingston" /></label>
              <label>Costo ($)<input type="number" value={intervForm.costo} onChange={(e) => setIntervForm({ ...intervForm, costo: e.target.value })} /></label>
            </div>
            <button type="submit" className="secondary" disabled={!intervForm.tipo.trim()} style={{ alignSelf: 'flex-start' }}>Agregar</button>
          </form>
        </div>

        <button style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer' }} onClick={() => eliminar(detalle._id)}>Eliminar equipo</button>
      </div>
    );
  }

  // ---- VISTA LISTA ----
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Reacondicionamiento de equipos</h2>
        <button onClick={() => setVista('nuevo')}>+ Ingresar equipo</button>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 16 }}>
          {ESTADOS.map((e) => (
            <div key={e.value} className="card" style={{ padding: '10px 14px', textAlign: 'center', cursor: 'pointer', border: filtro === e.value ? `2px solid ${e.color}` : undefined }} onClick={() => setFiltro(filtro === e.value ? '' : e.value)}>
              <div style={{ fontSize: 22, fontWeight: 700, color: e.color }}>{stats.porEstado?.[e.value] ?? 0}</div>
              <div style={{ fontSize: 12, color: 'var(--gris)' }}>{e.label}</div>
            </div>
          ))}
        </div>
      )}

      {items.length === 0 && <p className="muted">No hay equipos{filtro ? ` en estado "${estadoLabel(filtro).label}"` : ''}. Ingresá uno para empezar.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((eq) => {
          const est = estadoLabel(eq.estado);
          return (
            <div key={eq._id} className="card" style={{ padding: 14, cursor: 'pointer' }} onClick={() => verDetalle(eq._id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <b>{eq.marca} {eq.modelo || TIPOS.find((t) => t.value === eq.tipo)?.label}</b>
                  <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>S/N: {eq.numeroSerie}</span>
                </div>
                <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#fff', background: est.color }}>{est.label}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--gris)', marginTop: 4 }}>
                {eq.origenNombre && <span>{eq.origenNombre} · </span>}
                Ingreso: {new Date(eq.fechaIngreso).toLocaleDateString('es-AR')}
                {eq.intervenciones?.length > 0 && <span> · {eq.intervenciones.length} intervención{eq.intervenciones.length !== 1 ? 'es' : ''}</span>}
                {eq.costoTotal > 0 && <span> · Costo: ${eq.costoTotal.toLocaleString('es-AR')}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
