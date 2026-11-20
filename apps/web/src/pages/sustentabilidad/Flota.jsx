// Flota: vehículos de la cooperativa + cargas de combustible, con IA para parsear tickets.
import { useEffect, useState } from 'react';
import { api, apiForm, fmtFecha, isoDate } from '../../api.js';

const TIPOS = ['nafta', 'diesel', 'gnc', 'electrico'];

export default function Flota() {
  const [tab, setTab] = useState('vehiculos');
  return (
    <div className="pant pant-ancha">
      <h1>Flota y combustible</h1>
      <p className="ayuda-pant">Cargá los vehículos de tu cooperativa y las cargas de combustible. El cálculo de huella de carbono las toma automáticamente.</p>
      <div className="tabs">
        <button className={tab === 'vehiculos' ? 'activo' : ''} onClick={() => setTab('vehiculos')}>Vehículos</button>
        <button className={tab === 'combustibles' ? 'activo' : ''} onClick={() => setTab('combustibles')}>Cargas de combustible</button>
      </div>
      {tab === 'vehiculos' ? <Vehiculos /> : <Combustibles />}
    </div>
  );
}

function Vehiculos() {
  const [items, setItems] = useState([]);
  const [nuevo, setNuevo] = useState(null);
  async function refrescar() { setItems((await api('/consumos/vehiculos')).items); }
  useEffect(() => { refrescar(); }, []);

  async function eliminar(id) {
    if (!confirm('¿Eliminar vehículo?')) return;
    await api(`/consumos/vehiculos/${id}`, { method: 'DELETE' });
    refrescar();
  }

  return (
    <>
      <div className="barra-filtros">
        <button onClick={() => setNuevo({ patente: '', marca: '', modelo: '', anio: '', tipoCombustible: 'diesel', capacidadKg: '' })}>Nuevo vehículo</button>
      </div>
      <table className="tabla">
        <thead><tr><th>Patente</th><th>Marca / Modelo</th><th>Año</th><th>Combustible</th><th>Capacidad</th><th>Activo</th><th></th></tr></thead>
        <tbody>
          {items.map((v) => (
            <tr key={v._id}>
              <td><strong>{v.patente}</strong></td>
              <td>{[v.marca, v.modelo].filter(Boolean).join(' ') || '—'}</td>
              <td>{v.anio || '—'}</td>
              <td>{v.tipoCombustible}</td>
              <td>{v.capacidadKg ? `${v.capacidadKg} kg` : '—'}</td>
              <td>{v.activo ? 'sí' : 'no'}</td>
              <td><button className="link" onClick={() => eliminar(v._id)}>×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {nuevo && <ModalVehiculo draft={nuevo} setDraft={setNuevo} onSaved={() => { setNuevo(null); refrescar(); }} />}
    </>
  );
}

function ModalVehiculo({ draft, setDraft, onSaved }) {
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  async function guardar(e) {
    e.preventDefault();
    setGuardando(true); setError('');
    try {
      await api('/consumos/vehiculos', { method: 'POST', body: {
        ...draft,
        anio: draft.anio ? Number(draft.anio) : undefined,
        capacidadKg: draft.capacidadKg ? Number(draft.capacidadKg) : undefined,
      } });
      onSaved();
    } catch (e2) { setError(e2.message); } finally { setGuardando(false); }
  }
  return (
    <div className="dialog" role="dialog">
      <div className="dialog-body">
        <h2>Nuevo vehículo</h2>
        <label>Patente<input value={draft.patente} onChange={(e) => setDraft({ ...draft, patente: e.target.value.toUpperCase() })} required /></label>
        <label>Marca<input value={draft.marca} onChange={(e) => setDraft({ ...draft, marca: e.target.value })} /></label>
        <label>Modelo<input value={draft.modelo} onChange={(e) => setDraft({ ...draft, modelo: e.target.value })} /></label>
        <label>Año<input type="number" value={draft.anio} onChange={(e) => setDraft({ ...draft, anio: e.target.value })} /></label>
        <label>Combustible
          <select value={draft.tipoCombustible} onChange={(e) => setDraft({ ...draft, tipoCombustible: e.target.value })}>
            {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>Capacidad (kg)<input type="number" value={draft.capacidadKg} onChange={(e) => setDraft({ ...draft, capacidadKg: e.target.value })} /></label>
        {error && <div className="aviso aviso-error">{error}</div>}
        <div className="acciones">
          <button onClick={guardar} disabled={!draft.patente || guardando}>{guardando ? 'Guardando...' : 'Crear'}</button>
          <button className="link" onClick={() => setDraft(null)}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function Combustibles() {
  const [items, setItems] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [nuevo, setNuevo] = useState(null);

  async function refrescar() {
    const [c, v] = await Promise.all([api('/consumos/combustibles'), api('/consumos/vehiculos')]);
    setItems(c.items);
    setVehiculos(v.items);
  }
  useEffect(() => { refrescar(); }, []);

  async function eliminar(id) {
    if (!confirm('¿Eliminar carga?')) return;
    await api(`/consumos/combustibles/${id}`, { method: 'DELETE' });
    refrescar();
  }

  return (
    <>
      <div className="barra-filtros">
        <button onClick={() => setNuevo({ vehiculo: vehiculos[0]?._id || '', fecha: isoDate(), cantidad: '', importe: '', kmActual: '', observaciones: '' })} disabled={!vehiculos.length}>
          {vehiculos.length ? 'Nueva carga' : 'Primero dar de alta un vehículo'}
        </button>
      </div>
      <table className="tabla">
        <thead><tr><th>Fecha</th><th>Vehículo</th><th>Combustible</th><th>Cantidad</th><th>Importe</th><th>CO₂</th><th>Km</th><th></th></tr></thead>
        <tbody>
          {items.map((c) => (
            <tr key={c._id}>
              <td>{fmtFecha(c.fecha)}</td>
              <td>{c.vehiculo?.patente || '—'}</td>
              <td>{c.tipoCombustible}</td>
              <td style={{ textAlign: 'right' }}>{c.cantidad} {c.unidad}</td>
              <td style={{ textAlign: 'right' }}>{c.importe ? `$ ${Number(c.importe).toLocaleString('es-AR')}` : '—'}</td>
              <td style={{ textAlign: 'right' }}>{c.kgCo2} kg</td>
              <td style={{ textAlign: 'right' }}>{c.kmActual || '—'}</td>
              <td><button className="link" onClick={() => eliminar(c._id)}>×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {nuevo && <ModalCombustible draft={nuevo} setDraft={setNuevo} vehiculos={vehiculos} onSaved={() => { setNuevo(null); refrescar(); }} />}
    </>
  );
}

function ModalCombustible({ draft, setDraft, vehiculos, onSaved }) {
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [parseando, setParseando] = useState(false);
  const [iaMsg, setIaMsg] = useState('');

  async function parsearFoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseando(true); setIaMsg(''); setError('');
    try {
      const form = new FormData();
      form.append('foto', file);
      const r = await apiForm('/consumos/combustibles/parse-ticket', form);
      if (!r.disponible) { setIaMsg(`IA no disponible: ${r.motivo}`); return; }
      const d = r.datos || {};
      setDraft({
        ...draft,
        fecha: d.fecha || draft.fecha,
        cantidad: d.cantidad ?? draft.cantidad,
        importe: d.importe ?? draft.importe,
        kmActual: d.kmActual ?? draft.kmActual,
        observaciones: d.observaciones || draft.observaciones,
      });
      setIaMsg('✓ Datos cargados desde la foto. Revisá antes de guardar.');
    } catch (e2) { setError(e2.message); } finally { setParseando(false); }
  }

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true); setError('');
    try {
      await api('/consumos/combustibles', { method: 'POST', body: {
        vehiculo: draft.vehiculo,
        fecha: draft.fecha,
        cantidad: Number(draft.cantidad),
        importe: Number(draft.importe) || 0,
        kmActual: draft.kmActual ? Number(draft.kmActual) : undefined,
        observaciones: draft.observaciones || undefined,
      } });
      onSaved();
    } catch (e2) { setError(e2.message); } finally { setGuardando(false); }
  }

  return (
    <div className="dialog" role="dialog">
      <div className="dialog-body">
        <h2>Nueva carga de combustible</h2>

        <div className="tarjeta" style={{ background: '#f0fdfa', marginBottom: 12 }}>
          <p className="ayuda" style={{ margin: 0 }}>Opcional: sacá foto del ticket y la IA completa los campos.</p>
          <input type="file" accept="image/*" capture="environment" onChange={parsearFoto} disabled={parseando} />
          {parseando && <p className="ayuda">Analizando imagen...</p>}
          {iaMsg && <p className="ayuda">{iaMsg}</p>}
        </div>

        <label>Vehículo
          <select value={draft.vehiculo} onChange={(e) => setDraft({ ...draft, vehiculo: e.target.value })} required>
            {vehiculos.map((v) => <option key={v._id} value={v._id}>{v.patente} ({v.tipoCombustible})</option>)}
          </select>
        </label>
        <label>Fecha<input type="date" value={draft.fecha} onChange={(e) => setDraft({ ...draft, fecha: e.target.value })} required /></label>
        <label>Cantidad (L o m³)<input type="number" step="0.01" value={draft.cantidad} onChange={(e) => setDraft({ ...draft, cantidad: e.target.value })} required /></label>
        <label>Importe (ARS)<input type="number" step="0.01" value={draft.importe} onChange={(e) => setDraft({ ...draft, importe: e.target.value })} /></label>
        <label>Kilometraje actual<input type="number" value={draft.kmActual} onChange={(e) => setDraft({ ...draft, kmActual: e.target.value })} /></label>
        <label>Observaciones<input value={draft.observaciones} onChange={(e) => setDraft({ ...draft, observaciones: e.target.value })} placeholder="Estación, dirección..." /></label>

        {error && <div className="aviso aviso-error">{error}</div>}
        <div className="acciones">
          <button onClick={guardar} disabled={!draft.vehiculo || !draft.cantidad || guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
          <button className="link" onClick={() => setDraft(null)}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
