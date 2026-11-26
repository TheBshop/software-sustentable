import { useState, useEffect } from 'react';
import { api, apiForm, fileUrl } from '../../api.js';

const TIPOS = [
  { value: 'disco_rigido', label: 'Disco rígido (HDD)' },
  { value: 'ssd', label: 'SSD' },
  { value: 'pendrive', label: 'Pendrive / USB' },
  { value: 'cinta_magnetica', label: 'Cinta magnética' },
  { value: 'telefono', label: 'Teléfono' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'notebook', label: 'Notebook' },
  { value: 'servidor', label: 'Servidor' },
  { value: 'otro', label: 'Otro' },
];

const METODOS = [
  { value: 'borrado_seguro', label: 'Borrado seguro (sobreescritura)' },
  { value: 'desmagnetizacion', label: 'Desmagnetización' },
  { value: 'destruccion_fisica', label: 'Destrucción física' },
  { value: 'borrado_criptografico', label: 'Borrado criptográfico' },
];

const vacio = () => ({ tipo: 'disco_rigido', marca: '', modelo: '', numeroSerie: '', capacidad: '', metodo: 'borrado_seguro', notas: '' });

export default function Destruccion() {
  const [items, setItems] = useState([]);
  const [vista, setVista] = useState('lista');
  const [form, setForm] = useState({ clienteNombre: '', clienteCuit: '', responsable: '', fechaDestruccion: new Date().toISOString().slice(0, 10), observaciones: '' });
  const [dispositivos, setDispositivos] = useState([vacio()]);
  const [foto, setFoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    try {
      const data = await api('/destruccion');
      setItems(data.items ?? []);
    } catch {}
  }

  function setD(i, k, v) {
    setDispositivos((ds) => ds.map((d, j) => (j === i ? { ...d, [k]: v } : d)));
  }

  function agregarDispositivo() {
    setDispositivos((ds) => [...ds, vacio()]);
  }

  function quitarDispositivo(i) {
    setDispositivos((ds) => ds.filter((_, j) => j !== i));
  }

  async function guardar(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('datos', JSON.stringify({ ...form, dispositivos }));
      if (foto) fd.append('foto', foto);
      await apiForm('/destruccion', fd);
      setVista('lista');
      setForm({ clienteNombre: '', clienteCuit: '', responsable: '', fechaDestruccion: new Date().toISOString().slice(0, 10), observaciones: '' });
      setDispositivos([vacio()]);
      setFoto(null);
      cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este registro de destrucción?')) return;
    try {
      await api(`/destruccion/${id}`, { method: 'DELETE' });
      setItems((r) => r.filter((x) => x._id !== id));
    } catch {}
  }

  async function descargarPdf(id, numero) {
    try {
      const token = localStorage.getItem('token');
      const base = import.meta.env.VITE_API || '';
      const res = await fetch(`${base}/api/destruccion/${id}/pdf`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Error al generar el PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificado-destruccion-${String(numero).padStart(6, '0')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  }

  const formOk = form.clienteNombre.trim() && form.responsable.trim() && form.fechaDestruccion && dispositivos.length > 0 && dispositivos.every((d) => d.numeroSerie.trim());

  if (vista === 'nueva') {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Nueva destrucción segura</h2>
          <button className="secondary" onClick={() => setVista('lista')}>Volver</button>
        </div>
        <form className="card" onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <legend style={{ fontWeight: 600, marginBottom: 4 }}>Datos del cliente</legend>
            <label>
              Nombre / Razón social
              <input value={form.clienteNombre} onChange={(e) => setForm({ ...form, clienteNombre: e.target.value })} required />
            </label>
            <label>
              CUIT <span className="muted" style={{ fontWeight: 400 }}>(opcional)</span>
              <input value={form.clienteCuit} onChange={(e) => setForm({ ...form, clienteCuit: e.target.value })} placeholder="30-12345678-9" />
            </label>
          </fieldset>

          <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <legend style={{ fontWeight: 600, marginBottom: 4 }}>Destrucción</legend>
            <label>
              Fecha de destrucción
              <input type="date" value={form.fechaDestruccion} onChange={(e) => setForm({ ...form, fechaDestruccion: e.target.value })} required />
            </label>
            <label>
              Responsable
              <input value={form.responsable} onChange={(e) => setForm({ ...form, responsable: e.target.value })} required placeholder="Nombre del responsable" />
            </label>
          </fieldset>

          <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <legend style={{ fontWeight: 600, marginBottom: 4 }}>Dispositivos ({dispositivos.length})</legend>
            {dispositivos.map((d, i) => (
              <div key={i} style={{ padding: 12, border: '1px solid var(--borde, #e2e8ea)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--fondo, #f5f7f8)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>Dispositivo {i + 1}</span>
                  {dispositivos.length > 1 && <button type="button" onClick={() => quitarDispositivo(i)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12 }}>Quitar</button>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <label>
                    Tipo
                    <select value={d.tipo} onChange={(e) => setD(i, 'tipo', e.target.value)}>
                      {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </label>
                  <label>
                    Método
                    <select value={d.metodo} onChange={(e) => setD(i, 'metodo', e.target.value)}>
                      {METODOS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </label>
                </div>
                <label>
                  Número de serie *
                  <input value={d.numeroSerie} onChange={(e) => setD(i, 'numeroSerie', e.target.value)} required placeholder="Ej: WD-WX11A80W1234" />
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <label>
                    Marca
                    <input value={d.marca} onChange={(e) => setD(i, 'marca', e.target.value)} placeholder="Ej: Western Digital" />
                  </label>
                  <label>
                    Modelo
                    <input value={d.modelo} onChange={(e) => setD(i, 'modelo', e.target.value)} placeholder="Ej: WD10EZEX" />
                  </label>
                  <label>
                    Capacidad
                    <input value={d.capacidad} onChange={(e) => setD(i, 'capacidad', e.target.value)} placeholder="Ej: 1 TB" />
                  </label>
                </div>
              </div>
            ))}
            <button type="button" className="secondary" onClick={agregarDispositivo} style={{ alignSelf: 'flex-start' }}>+ Agregar dispositivo</button>
          </fieldset>

          <label>
            Foto de evidencia <span className="muted" style={{ fontWeight: 400 }}>(opcional)</span>
            <input type="file" accept="image/*" capture="environment" onChange={(e) => setFoto(e.target.files?.[0])} />
          </label>

          <label>
            Observaciones <span className="muted" style={{ fontWeight: 400 }}>(opcional)</span>
            <textarea value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} rows={3} />
          </label>

          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" disabled={loading || !formOk}>{loading ? 'Guardando…' : 'Registrar destrucción y generar certificado'}</button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Destrucción segura de datos</h2>
        <button onClick={() => setVista('nueva')}>+ Nueva destrucción</button>
      </div>

      {items.length === 0 && <p className="muted">No hay registros de destrucción. Creá uno para generar el certificado.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map((r) => (
          <div key={r._id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <b>N° {String(r.numero).padStart(6, '0')}</b>
                <span className="muted" style={{ marginLeft: 8, fontSize: 13 }}>{new Date(r.fechaDestruccion).toLocaleDateString('es-AR')}</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="secondary sm" onClick={() => descargarPdf(r._id, r.numero)}>Certificado PDF</button>
                <button className="secondary sm" style={{ color: '#dc2626' }} onClick={() => eliminar(r._id)}>Eliminar</button>
              </div>
            </div>
            <div style={{ fontSize: 14 }}>
              <span style={{ fontWeight: 500 }}>{r.clienteNombre}</span>
              {r.clienteCuit && <span className="muted" style={{ marginLeft: 8 }}>CUIT {r.clienteCuit}</span>}
            </div>
            <div style={{ fontSize: 13, color: 'var(--gris)' }}>
              {r.dispositivos?.length ?? 0} dispositivo{(r.dispositivos?.length ?? 0) !== 1 ? 's' : ''} · Responsable: {r.responsable}
            </div>
            {r.fotoEvidencia && (
              <img src={fileUrl(r.fotoEvidencia)} alt="Evidencia" style={{ maxWidth: 200, borderRadius: 8, marginTop: 4 }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
