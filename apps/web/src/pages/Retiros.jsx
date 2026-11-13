import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, fmtKg, fmtFechaCorta, pad } from '../api.js';
import { useLoad, Tag, ErrorMsg } from '../ui.jsx';

const peso = (it) => it.pesoRealKg ?? it.pesoEstimadoKg;

/**
 * Bandeja de la planta: los retiros que mandan los choferes. Desde acá se carga el peso
 * de balanza y se emite el certificado.
 */
export default function Retiros() {
  const [cliente, setCliente] = useState('');
  const [estado, setEstado] = useState('');
  const qs = new URLSearchParams({ limit: '100', ...(cliente && { cliente }), ...(estado && { estado }) });
  const { data, error, reload } = useLoad(`/retiros?${qs}`);
  const clientes = useLoad('/clientes?limit=200');
  const [editing, setEditing] = useState(null); // { id, pesos: { [i]: '123' } }
  const [actionError, setActionError] = useState(null);
  const [flash, setFlash] = useState(null);
  const navigate = useNavigate();

  async function guardarPeso(r) {
    setActionError(null);
    try {
      const items = r.items.map((it, i) => {
        const real = Number(editing.pesos[i]);
        if (!(real >= 0) || editing.pesos[i] === '') throw new Error('Completá el peso de todos los materiales.');
        return { material: it.material._id, pesoEstimadoKg: it.pesoEstimadoKg, pesoRealKg: real };
      });
      await api(`/retiros/${r._id}`, { method: 'PATCH', body: { items, estado: 'en_planta' } });
      setEditing(null);
      setFlash(r._id);
      await reload();
    } catch (e) {
      setActionError(e.message);
    }
  }

  async function emitir(r) {
    setActionError(null);
    try {
      const cert = await api(`/retiros/${r._id}/certificado`, { method: 'POST' });
      navigate(`/certificados?id=${cert._id}`);
    } catch (e) {
      setActionError(e.message);
    }
  }

  const items = data?.items ?? [];
  const pendientes = items.filter((r) => r.estado === 'registrado').length;

  return (
    <>
      <div className="view-head">
        <div>
          <h2>Retiros</h2>
          <p className="muted">{pendientes ? `${pendientes} retiro${pendientes > 1 ? 's' : ''} esperando el peso de balanza` : 'Todos los retiros listados están pesados'}</p>
        </div>
        <div className="row">
          <select aria-label="Cliente" value={cliente} onChange={(e) => setCliente(e.target.value)}>
            <option value="">Todos los clientes</option>
            {clientes.data?.items.map((c) => <option key={c._id} value={c._id}>{c.razonSocial}</option>)}
          </select>
          <select aria-label="Estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="registrado">Sin pesar</option>
            <option value="en_planta">Pesados en planta</option>
            <option value="anulado">Anulados</option>
          </select>
        </div>
      </div>
      <ErrorMsg error={error || actionError} />
      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>N°</th><th>Fecha</th><th>Cliente</th><th>Materiales</th><th className="r">Total</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {items.map((r) => {
                const estimado = r.items.some((it) => it.pesoRealKg == null);
                const total = r.items.reduce((a, it) => a + peso(it), 0);
                return [
                  <tr key={r._id} className={flash === r._id ? 'flash' : ''}>
                    <td className="mono">{pad(r.numero)}</td>
                    <td className="num">{fmtFechaCorta(r.fecha)}</td>
                    <td>{r.cliente?.razonSocial}<div className="muted small">{r.chofer?.nombre}</div></td>
                    <td>
                      {r.items.map((it) => `${it.material?.nombre} ${fmtKg(peso(it))}`).join(' · ')}
                      <div className="muted small">
                        {r.fotos.length ? r.fotos.map((f, i) => <a key={f.url} href={f.url} target="_blank" rel="noreferrer">foto {i + 1} </a>) : 'sin fotos'}
                        {r.observaciones && ` · ${r.observaciones}`}
                      </div>
                    </td>
                    <td className="r num">{fmtKg(total)}{estimado && <div className="muted small">estimado</div>}</td>
                    <td>
                      <div className="tags">
                        {r.estado === 'registrado' && <Tag tone="sun">Sin pesar</Tag>}
                        {r.estado === 'en_planta' && <Tag tone="info">Pesado</Tag>}
                        {r.estado === 'anulado' && <Tag tone="red">Anulado</Tag>}
                        {r.certificado && <Tag tone="green">Certificado</Tag>}
                        {r.factura && <Tag>Facturado</Tag>}
                      </div>
                    </td>
                    <td>
                      <div className="actions">
                        {!r.factura && r.estado !== 'anulado' && (
                          <button type="button" className="secondary sm" onClick={() => setEditing({ id: r._id, pesos: Object.fromEntries(r.items.map((it, i) => [i, String(it.pesoRealKg ?? it.pesoEstimadoKg)])) })}>
                            {r.estado === 'en_planta' ? 'Corregir peso' : 'Pesar'}
                          </button>
                        )}
                        {r.certificado ? (
                          <Link className="button secondary sm" to={`/certificados?id=${r.certificado}`}>Ver certificado</Link>
                        ) : (
                          r.estado !== 'anulado' && <button type="button" className="sm" onClick={() => emitir(r)}>Emitir certificado</button>
                        )}
                      </div>
                    </td>
                  </tr>,
                  editing?.id === r._id && (
                    <tr key={`${r._id}-edit`} className="edit-row">
                      <td colSpan={7}>
                        <div className="edit-grid">
                          {r.items.map((it, i) => (
                            <label key={i}>
                              {it.material?.nombre} · kg de balanza
                              <input
                                type="number" min="0" step="any" autoFocus={i === 0}
                                value={editing.pesos[i]}
                                onChange={(e) => setEditing({ ...editing, pesos: { ...editing.pesos, [i]: e.target.value } })}
                              />
                              <span className="muted small">estimado: {fmtKg(it.pesoEstimadoKg)}</span>
                            </label>
                          ))}
                          <div className="row">
                            <button type="button" onClick={() => guardarPeso(r)}>Guardar peso</button>
                            <button type="button" className="secondary" onClick={() => setEditing(null)}>Cancelar</button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ),
                ];
              })}
              {!items.length && <tr><td colSpan={7} className="muted">No hay retiros con estos filtros.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
