import { useState } from 'react';
import { fmtKg, fmtFecha, pad } from '../../api.js';
import { useLoad, ErrorMsg, Tag } from '../../ui.jsx';
import { FraccionChip } from '../../residuos.jsx';
import { ANIOS } from './Inicio.jsx';

export default function PortalRetiros() {
  const [anio, setAnio] = useState(ANIOS[0]);
  const [sede, setSede] = useState('');
  const { data, error } = useLoad(`/v1/portal/retiros?anio=${anio}`);
  const items = data?.items ?? [];
  const sedes = [...new Set(items.map((r) => r.sede).filter(Boolean))];
  const filas = sede ? items.filter((r) => r.sede === sede) : items;

  return (
    <>
      <div className="view-head">
        <div>
          <h2>Retiros</h2>
          <p className="muted">{filas.length} retiros · {fmtKg(filas.reduce((a, r) => a + r.materiales.reduce((b, m) => b + m.kg, 0), 0))}</p>
        </div>
        <div className="row">
          {sedes.length > 1 && (
            <select aria-label="Sede" value={sede} onChange={(e) => setSede(e.target.value)}>
              <option value="">Todas las sedes</option>
              {sedes.map((s) => <option key={s}>{s}</option>)}
            </select>
          )}
          <select aria-label="Año" value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
            {ANIOS.map((a) => <option key={a}>{a}</option>)}
          </select>
        </div>
      </div>
      <ErrorMsg error={error} />
      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Fecha</th><th>Sede</th><th>Materiales</th><th className="r">Kilos</th><th>Cooperativa</th><th>Estado</th></tr></thead>
            <tbody>
              {filas.map((r) => (
                <tr key={r.id}>
                  <td className="num">{fmtFecha(r.fecha)}<div className="muted small mono">N° {pad(r.numero)}</div></td>
                  <td>{r.sede ?? '—'}</td>
                  <td>
                    {r.materiales.map((m) => (
                      <div key={m.nombre}><FraccionChip fraccion={m.fraccion} corriente={m.corriente} /> <span className="muted">· {m.nombre}</span></div>
                    ))}
                  </td>
                  <td className="r num">{fmtKg(r.materiales.reduce((a, m) => a + m.kg, 0))}{!r.pesado && <div className="muted small">estimado</div>}</td>
                  <td className="small">{r.cooperativa}</td>
                  <td>
                    {r.estado === 'anulado' ? <Tag tone="red">Anulado</Tag> : r.certificado ? <Tag tone="green">Certificado</Tag> : r.pesado ? <Tag tone="info">Pesado</Tag> : <Tag tone="sun">En proceso</Tag>}
                  </td>
                </tr>
              ))}
              {!filas.length && <tr><td colSpan={6} className="muted">No hay retiros en {anio}.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
