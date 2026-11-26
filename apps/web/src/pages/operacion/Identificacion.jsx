import { useState } from 'react';
import { apiForm, api, fileUrl } from '../../api.js';
import { useLoad } from '../../ui.jsx';

const COLORES = { true: 'green', false: 'gray' };

function NuevoAnalisis({ onListo }) {
  const [preview, setPreview] = useState(null);
  const [archivo, setArchivo] = useState(null);
  const [ubicacion, setUbicacion] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  function onFoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setArchivo(file);
    setPreview(URL.createObjectURL(file));
    setError(null);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUbicacion({ lat: pos.coords.latitude, lng: pos.coords.longitude, precision: pos.coords.accuracy }),
        () => {},
        { enableHighAccuracy: true, timeout: 10000 },
      );
    }
  }

  async function enviar() {
    if (!archivo) return;
    setCargando(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('foto', archivo);
      if (ubicacion) {
        fd.append('lat', ubicacion.lat);
        fd.append('lng', ubicacion.lng);
        if (ubicacion.precision) fd.append('precision', ubicacion.precision);
      }
      await apiForm('/identificacion/analizar', fd);
      setPreview(null);
      setArchivo(null);
      setUbicacion(null);
      onListo();
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="card stack">
      <h3>Identificar residuos</h3>
      <p className="muted">Sacá una foto con tu celular o subí una imagen. La IA identifica los residuos, su tipo y qué hacer con ellos.</p>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <label className="primary button" style={{ cursor: 'pointer', margin: 0 }}>
          📷 Sacar foto
          <input type="file" accept="image/*" capture="environment" onChange={onFoto} hidden />
        </label>
        <label className="secondary button" style={{ cursor: 'pointer', margin: 0 }}>
          Subir imagen
          <input type="file" accept="image/*" onChange={onFoto} hidden />
        </label>
      </div>
      {preview && (
        <div>
          <img src={preview} alt="Vista previa" style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 8, border: '1px solid var(--borde)' }} />
          {ubicacion && <p className="small muted" style={{ marginTop: 4 }}>Ubicación: {ubicacion.lat.toFixed(5)}, {ubicacion.lng.toFixed(5)} (±{ubicacion.precision?.toFixed(0) ?? '?'} m)</p>}
          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" onClick={enviar} disabled={cargando}>{cargando ? 'Analizando…' : 'Analizar con IA'}</button>
          </div>
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}

function Resultado({ r }) {
  return (
    <div className="card stack" style={{ gap: 10 }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <img src={fileUrl(r.foto)} alt="Foto" style={{ width: 120, height: 90, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--borde)' }} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="small muted">{new Date(r.createdAt).toLocaleString('es-AR')} · {r.usuario?.nombre ?? '—'}</div>
          {r.ubicacion?.lat && <div className="small muted">📍 {r.ubicacion.lat.toFixed(4)}, {r.ubicacion.lng.toFixed(4)}{r.ubicacion.direccion ? ` · ${r.ubicacion.direccion}` : ''}</div>}
          {r.observaciones && <p style={{ margin: '6px 0 0', fontSize: 14 }}>{r.observaciones}</p>}
          {r.recomendacion && <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--verde-oscuro)', fontWeight: 600 }}>{r.recomendacion}</p>}
        </div>
      </div>
      {r.items?.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Residuo</th><th>Material</th><th>Cantidad</th><th>Estado</th><th>Reciclable</th><th>Peligroso</th><th>Corriente</th></tr>
            </thead>
            <tbody>
              {r.items.map((it, i) => (
                <tr key={i}>
                  <td><b>{it.tipo}</b></td>
                  <td>{it.material}</td>
                  <td className="small">{it.cantidad_estimada}</td>
                  <td><span className="tag gray">{it.estado}</span></td>
                  <td>{it.reciclable ? <span className="tag green">Sí</span> : <span className="tag gray">No</span>}</td>
                  <td>{it.peligroso ? <span className="tag red">Sí</span> : <span className="tag gray">No</span>}</td>
                  <td className="small">{it.corriente}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Identificacion() {
  const { data, reload } = useLoad('/identificacion');
  return (
    <div className="stack">
      <div className="page-h">
        <div>
          <h2>Identificación de residuos</h2>
          <p className="muted">Sacá una foto y la IA identifica los residuos, su material y qué hacer con ellos.</p>
        </div>
      </div>
      <NuevoAnalisis onListo={reload} />
      {data?.items?.map((r) => <Resultado key={r._id} r={r} />)}
      {data?.items && !data.items.length && <p className="muted">Todavía no hay análisis. Sacá una foto para empezar.</p>}
    </div>
  );
}
