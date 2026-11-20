// Consumos de servicios (luz, gas, agua) con cálculo automático de huella de carbono.
import { useEffect, useMemo, useState } from 'react';
import { api, fmtFecha, isoDate } from '../../api.js';

const ETIQUETAS = { electricidad: 'Electricidad (kWh)', gas_natural: 'Gas natural (m³)', gas_envasado: 'Gas envasado (kg)', agua: 'Agua (m³)' };

export default function Consumos() {
  const [items, setItems] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [nuevo, setNuevo] = useState(null);
  const [catalogos, setCatalogos] = useState(null);

  async function refrescar() {
    const [s, c] = await Promise.all([api('/consumos/servicios'), api('/consumos/catalogos')]);
    setItems(s.items);
    setCatalogos(c);
  }
  useEffect(() => { refrescar(); }, []);

  async function eliminar(id) {
    if (!confirm('¿Eliminar este consumo?')) return;
    await api(`/consumos/servicios/${id}`, { method: 'DELETE' });
    refrescar();
  }

  const filtrados = useMemo(() => filtro ? items.filter((i) => i.tipo === filtro) : items, [items, filtro]);
  const totalMes = useMemo(() => {
    const now = new Date();
    return items.filter((i) => new Date(i.fecha).getMonth() === now.getMonth()).reduce((a, i) => a + i.kgCo2, 0);
  }, [items]);

  return (
    <div className="pant pant-ancha">
      <h1>Consumos de servicios</h1>
      <p className="ayuda-pant">Cargá facturas de luz, gas y agua para calcular tu huella de carbono. Los factores se aplican automáticamente (podés ajustarlos editando los valores de referencia).</p>

      <div className="kpis">
        <div className="kpi"><div className="kpi-titulo">Registros</div><div className="kpi-valor">{items.length}</div></div>
        <div className="kpi"><div className="kpi-titulo">CO₂ emitido este mes</div><div className="kpi-valor">{totalMes.toFixed(1)} kg</div></div>
      </div>

      <div className="barra-filtros">
        <label>Tipo
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(ETIQUETAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <button onClick={() => setNuevo({ tipo: 'electricidad', fecha: isoDate(), cantidad: '', importe: '', proveedor: '', sede: '' })}>Cargar consumo</button>
      </div>

      <table className="tabla">
        <thead><tr><th>Fecha</th><th>Tipo</th><th>Cantidad</th><th>Importe</th><th>CO₂ (kg)</th><th>Proveedor</th><th>Sede</th><th></th></tr></thead>
        <tbody>
          {filtrados.map((c) => (
            <tr key={c._id}>
              <td>{fmtFecha(c.fecha)}</td>
              <td>{ETIQUETAS[c.tipo] || c.tipo}</td>
              <td style={{ textAlign: 'right' }}>{c.cantidad} {c.unidad}</td>
              <td style={{ textAlign: 'right' }}>{c.importe ? `$ ${Number(c.importe).toLocaleString('es-AR')}` : '—'}</td>
              <td style={{ textAlign: 'right' }}>{c.kgCo2}</td>
              <td>{c.proveedor || '—'}</td>
              <td>{c.sede || '—'}</td>
              <td><button className="link" onClick={() => eliminar(c._id)}>×</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {nuevo && catalogos && <Nuevo draft={nuevo} setDraft={setNuevo} catalogos={catalogos} onSaved={() => { setNuevo(null); refrescar(); }} />}
    </div>
  );
}

function Nuevo({ draft, setDraft, catalogos, onSaved }) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const factor = catalogos.factoresServicio[draft.tipo];
  const co2Estimado = (Number(draft.cantidad) || 0) * (factor?.kgCo2PorUnidad || 0);

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true); setError('');
    try {
      await api('/consumos/servicios', { method: 'POST', body: {
        ...draft,
        cantidad: Number(draft.cantidad),
        importe: Number(draft.importe) || 0,
      } });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally { setGuardando(false); }
  }

  return (
    <div className="dialog" role="dialog">
      <div className="dialog-body">
        <h2>Cargar consumo</h2>
        <label>Tipo
          <select value={draft.tipo} onChange={(e) => setDraft({ ...draft, tipo: e.target.value })}>
            {Object.entries(ETIQUETAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label>Fecha<input type="date" value={draft.fecha} onChange={(e) => setDraft({ ...draft, fecha: e.target.value })} /></label>
        <label>Cantidad ({factor?.unidad})<input type="number" step="0.01" value={draft.cantidad} onChange={(e) => setDraft({ ...draft, cantidad: e.target.value })} required /></label>
        <label>Importe (ARS)<input type="number" step="0.01" value={draft.importe} onChange={(e) => setDraft({ ...draft, importe: e.target.value })} /></label>
        <label>Proveedor<input value={draft.proveedor} onChange={(e) => setDraft({ ...draft, proveedor: e.target.value })} placeholder="Ej: Edenor, Metrogas, Aguas Provinciales" /></label>
        <label>Sede<input value={draft.sede} onChange={(e) => setDraft({ ...draft, sede: e.target.value })} placeholder="Ej: Planta principal" /></label>

        <p className="ayuda">Estimación de huella: <strong>{co2Estimado.toFixed(2)} kg CO₂</strong><br/>Factor: {factor?.kgCo2PorUnidad} kgCO₂/{factor?.unidad} — {factor?.fuente}</p>

        {error && <div className="aviso aviso-error">{error}</div>}
        <div className="acciones">
          <button onClick={guardar} disabled={!draft.cantidad || guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
          <button className="link" onClick={() => setDraft(null)}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
