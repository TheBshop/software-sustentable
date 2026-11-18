// Matriz de cumplimiento: 5 áreas con sus ítems. Los "auto" salen de los registros del sistema
// y los "manuales" se cargan con una evidencia (archivo, número, vencimiento o marca).
import { useState } from 'react';
import { api, apiForm, fileUrl, fmtFecha, getUser } from '../../api.js';
import { useLoad, ErrorMsg, ConfirmButton } from '../../ui.jsx';
import Ayuda from '../../shell/Ayuda.jsx';

const TONO = { cumple: 'green', vence_pronto: 'sun', vencido: 'red', no_cumple: 'red', sin_dato: 'gray', sin_cargar: 'gray' };
const ETIQUETA = { cumple: 'Cumple', vence_pronto: 'Vence pronto', vencido: 'Vencido', no_cumple: 'No cumple', sin_dato: 'Sin datos', sin_cargar: 'Sin cargar' };

function Evidencia({ item, onCambio }) {
  const [f, setF] = useState({ numero: item.numero ?? '', vence: item.venceEl ? item.venceEl.slice(0, 10) : '', notas: item.notas ?? '' });
  const [err, setErr] = useState(null);
  const admin = ['admin', 'administracion'].includes(getUser()?.rol);
  if (!admin) return null;

  async function guardar(e) {
    e.preventDefault();
    setErr(null);
    try {
      await api(`/cumplimiento/evidencias/${item.id}`, { method: 'PUT', body: { numero: f.numero || undefined, vence: f.vence || null, notas: f.notas || undefined } });
      onCambio();
    } catch (x) {
      setErr(x.message);
    }
  }
  async function subir(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('archivo', file);
    try {
      await apiForm(`/cumplimiento/evidencias/${item.id}/archivo`, fd);
      onCambio();
    } catch (x) {
      setErr(x.message);
    }
  }

  return (
    <form className="mz-form" onSubmit={guardar}>
      <input type="text" placeholder="N° inscripción, matrícula…" value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} aria-label="Número" />
      {item.vence !== false && <input type="date" value={f.vence} onChange={(e) => setF({ ...f, vence: e.target.value })} aria-label="Vence" />}
      <input type="text" placeholder="Nota" value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} aria-label="Nota" />
      <button type="submit" className="sm secondary">Guardar</button>
      <label className="button sm secondary" style={{ display: 'inline-flex', alignItems: 'center', margin: 0 }}>
        {item.archivoUrl ? 'Cambiar archivo' : 'Subir archivo'}
        <input type="file" accept="image/*,application/pdf" onChange={subir} style={{ display: 'none' }} />
      </label>
      {item.archivoUrl && <a href={fileUrl(item.archivoUrl)} target="_blank" rel="noreferrer" className="small">Ver: {item.archivoNombre}</a>}
      {(item.numero || item.vence || item.archivoUrl) && (
        <ConfirmButton onConfirm={() => api(`/cumplimiento/evidencias/${item.id}`, { method: 'DELETE' }).then(onCambio)}>Borrar</ConfirmButton>
      )}
      {err && <span className="error small">{err}</span>}
    </form>
  );
}

export default function Matriz() {
  const { data, error, reload } = useLoad('/cumplimiento');
  const [areaAbierta, setAreaAbierta] = useState(null);
  if (error) return <ErrorMsg error={error} />;
  if (!data) return <p className="muted">Cargando…</p>;
  if (data.perfil === 'municipio') return <p className="muted">La matriz de cumplimiento aplica a cooperativas y empresas recicladoras.</p>;

  const activa = areaAbierta ?? data.areas[0]?.area;
  const items = data.items.filter((i) => i.area === activa);

  return (
    <div className="stack">
      <div className="page-h">
        <div>
          <h2>Matriz de cumplimiento<Ayuda>Las 5 áreas que te aplican según el perfil, la jurisdicción y las corrientes de tratamiento. Los ítems automáticos se calculan de tus registros; los manuales se cumplen cargando una evidencia (archivo, número o marca).</Ayuda></h2>
          <p className="muted">Clic en un área para ver y cargar sus ítems.</p>
        </div>
      </div>
      <div className="kpis">
        {data.areas.map((a) => (
          <button key={a.area} type="button" className={`kpi kpi-link ${a.pct == null ? '' : a.pct === 100 ? '' : a.pct < 50 ? 'mal' : ''} ${a.area === activa ? 'activa' : ''}`} onClick={() => setAreaAbierta(a.area)} style={{ textAlign: 'left', border: a.area === activa ? '1px solid var(--verde)' : undefined }}>
            <span>{a.label}</span>
            <strong>{a.ok} de {a.total}</strong>
            <div className="barra-prog" aria-hidden="true"><i style={{ width: `${a.pct ?? 0}%`, background: a.pct === 100 ? 'var(--verde)' : a.pct < 50 ? 'var(--rojo)' : 'var(--sol)' }} /></div>
          </button>
        ))}
      </div>
      <section className="card stack">
        <h3>{data.areas.find((a) => a.area === activa)?.label}</h3>
        {items.map((it) => (
          <div key={it.id} className="mz-item">
            <div className="mz-h">
              <div>
                <b>{it.titulo}</b>
                <div className="small muted">{it.norma} · {it.porque}</div>
              </div>
              <span className={`tag ${TONO[it.estado.codigo]}`}>{ETIQUETA[it.estado.codigo]}</span>
            </div>
            <div className="small">{it.estado.txt}{it.venceEl && <span className="muted"> · {fmtFecha(it.venceEl)}</span>}</div>
            {it.tipo === 'manual' && <Evidencia item={it} onCambio={reload} />}
          </div>
        ))}
      </section>
    </div>
  );
}
