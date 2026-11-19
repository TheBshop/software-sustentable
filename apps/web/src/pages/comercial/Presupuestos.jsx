import { useEffect, useMemo, useState } from 'react';
import { api, openPdf, fmtFecha, isoDate } from '../../api.js';

const ESTADOS = ['vigente', 'aceptado', 'rechazado', 'vencido', 'convertido'];
const LINEA_VACIA = { descripcion: '', cantidad: 1, unidad: '', precioUnitario: 0 };

export default function Presupuestos() {
  const [lista, setLista] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [nuevo, setNuevo] = useState(null);

  async function refrescar() {
    const [p, c] = await Promise.all([api('/api/presupuestos'), api('/api/clientes?limit=200')]);
    setLista(p.items);
    setClientes(c.items);
  }
  useEffect(() => { refrescar(); }, []);

  async function cambiarEstado(p, estado) {
    await api(`/api/presupuestos/${p._id}/estado`, { method: 'POST', body: { estado } });
    refrescar();
  }
  async function convertir(p) {
    if (!confirm(`Convertir el presupuesto N° ${p.numero} en factura?`)) return;
    await api(`/api/presupuestos/${p._id}/convertir`, { method: 'POST', body: {} });
    refrescar();
  }

  const filtrados = useMemo(() => filtro ? lista.filter((p) => p.estado === filtro) : lista, [lista, filtro]);

  return (
    <div className="pant pant-ancha">
      <h1>Presupuestos</h1>
      <p className="ayuda-pant">Cotizaciones a enviar al cliente. Cuando se aceptan, se convierten en factura con un clic.</p>

      <div className="barra-filtros">
        <label>Estado
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="">Todos</option>
            {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </label>
        <button onClick={() => setNuevo({ cliente: '', vigenciaHasta: isoDate(new Date(Date.now() + 30 * 86400000)), notas: '', lineas: [{ ...LINEA_VACIA }] })}>Nuevo presupuesto</button>
      </div>

      <table className="tabla">
        <thead><tr><th>N°</th><th>Fecha</th><th>Cliente</th><th>Vigente hasta</th><th>Total</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          {filtrados.map((p) => (
            <tr key={p._id}>
              <td>{p.numero}</td>
              <td>{fmtFecha(p.emitidoEn)}</td>
              <td>{p.cliente?.razonSocial || p.clienteSnapshot?.razonSocial}</td>
              <td>{fmtFecha(p.vigenciaHasta)}</td>
              <td style={{ textAlign: 'right' }}>$ {Number(p.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
              <td><span className={`chip chip-${p.estado}`}>{p.estado}</span></td>
              <td>
                <button className="link" onClick={() => openPdf(`/api/presupuestos/${p._id}/pdf`)}>PDF</button>
                {p.estado === 'vigente' && <>
                  {' · '}<button className="link" onClick={() => cambiarEstado(p, 'aceptado')}>Marcar aceptado</button>
                  {' · '}<button className="link" onClick={() => cambiarEstado(p, 'rechazado')}>Rechazar</button>
                </>}
                {p.estado === 'aceptado' && <>{' · '}<button className="link" onClick={() => convertir(p)}>Convertir en factura</button></>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {nuevo && (
        <NuevoPresupuesto draft={nuevo} setDraft={setNuevo} clientes={clientes} onSaved={() => { setNuevo(null); refrescar(); }} />
      )}
    </div>
  );
}

function NuevoPresupuesto({ draft, setDraft, clientes, onSaved }) {
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const total = draft.lineas.reduce((a, l) => a + (Number(l.cantidad) || 0) * (Number(l.precioUnitario) || 0), 0);

  function setLinea(i, campo, valor) {
    const lineas = draft.lineas.map((l, j) => (j === i ? { ...l, [campo]: valor } : l));
    setDraft({ ...draft, lineas });
  }

  async function guardar() {
    setGuardando(true); setError('');
    try {
      const body = {
        cliente: draft.cliente,
        vigenciaHasta: draft.vigenciaHasta,
        notas: draft.notas || undefined,
        lineas: draft.lineas.map((l) => ({ ...l, cantidad: Number(l.cantidad), precioUnitario: Number(l.precioUnitario) })),
      };
      await api('/api/presupuestos', { method: 'POST', body });
      onSaved();
    } catch (err) {
      setError(err.message || 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="dialog" role="dialog">
      <div className="dialog-body">
        <h2>Nuevo presupuesto</h2>
        <label>Cliente
          <select value={draft.cliente} onChange={(e) => setDraft({ ...draft, cliente: e.target.value })}>
            <option value="">—</option>
            {clientes.map((c) => <option key={c._id} value={c._id}>{c.razonSocial}</option>)}
          </select>
        </label>
        <label>Vigencia hasta
          <input type="date" value={draft.vigenciaHasta} onChange={(e) => setDraft({ ...draft, vigenciaHasta: e.target.value })} />
        </label>

        <h3>Líneas</h3>
        <table className="tabla">
          <thead><tr><th>Descripción</th><th>Cant.</th><th>Unidad</th><th>Precio unit.</th><th>Subtotal</th><th></th></tr></thead>
          <tbody>
            {draft.lineas.map((l, i) => (
              <tr key={i}>
                <td><input value={l.descripcion} onChange={(e) => setLinea(i, 'descripcion', e.target.value)} /></td>
                <td><input type="number" step="0.01" value={l.cantidad} onChange={(e) => setLinea(i, 'cantidad', e.target.value)} /></td>
                <td><input value={l.unidad} onChange={(e) => setLinea(i, 'unidad', e.target.value)} /></td>
                <td><input type="number" step="0.01" value={l.precioUnitario} onChange={(e) => setLinea(i, 'precioUnitario', e.target.value)} /></td>
                <td style={{ textAlign: 'right' }}>$ {(Number(l.cantidad) * Number(l.precioUnitario)).toFixed(2)}</td>
                <td>{draft.lineas.length > 1 && <button className="link" onClick={() => setDraft({ ...draft, lineas: draft.lineas.filter((_, j) => j !== i) })}>×</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="link" onClick={() => setDraft({ ...draft, lineas: [...draft.lineas, { ...LINEA_VACIA }] })}>+ Agregar línea</button>

        <div style={{ marginTop: 12, textAlign: 'right' }}><strong>Total: $ {total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong></div>

        <label>Notas
          <textarea rows={3} value={draft.notas} onChange={(e) => setDraft({ ...draft, notas: e.target.value })} />
        </label>

        {error && <div className="aviso aviso-error">{error}</div>}
        <div className="acciones">
          <button onClick={guardar} disabled={!draft.cliente || !draft.lineas.length || guardando}>{guardando ? 'Guardando...' : 'Crear presupuesto'}</button>
          <button className="link" onClick={() => setDraft(null)}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
