// Página pública de recepción de manifiesto: se abre desde el QR del PDF.
// El destinatario firma en canvas, carga nombre/DNI, permite geolocalización y confirma.
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL ?? '';

function Firma({ onChange }) {
  const canvasRef = useRef(null);
  const trazo = useRef({ dibujando: false, hubo: false });

  useEffect(() => {
    const c = canvasRef.current;
    const ctx = c.getContext('2d');
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const pos = (e) => {
      const r = c.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      const y = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
      return [x * (c.width / r.width), y * (c.height / r.height)];
    };
    const start = (e) => { e.preventDefault(); trazo.current.dibujando = true; const [x, y] = pos(e); ctx.beginPath(); ctx.moveTo(x, y); };
    const move = (e) => { if (!trazo.current.dibujando) return; e.preventDefault(); const [x, y] = pos(e); ctx.lineTo(x, y); ctx.stroke(); trazo.current.hubo = true; onChange(c.toDataURL('image/png')); };
    const end = () => { trazo.current.dibujando = false; };
    c.addEventListener('mousedown', start);
    c.addEventListener('mousemove', move);
    c.addEventListener('mouseup', end);
    c.addEventListener('mouseleave', end);
    c.addEventListener('touchstart', start);
    c.addEventListener('touchmove', move);
    c.addEventListener('touchend', end);
    return () => {
      c.removeEventListener('mousedown', start);
      c.removeEventListener('mousemove', move);
      c.removeEventListener('mouseup', end);
      c.removeEventListener('mouseleave', end);
      c.removeEventListener('touchstart', start);
      c.removeEventListener('touchmove', move);
      c.removeEventListener('touchend', end);
    };
  }, [onChange]);

  const limpiar = () => {
    const c = canvasRef.current;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
    trazo.current.hubo = false;
    onChange('');
  };

  return (
    <div className="recibir-firma">
      <canvas ref={canvasRef} width={600} height={180} style={{ touchAction: 'none' }} />
      <button type="button" className="link" onClick={limpiar}>Borrar</button>
    </div>
  );
}

export default function RecibirManifiesto() {
  const { codigo } = useParams();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [firma, setFirma] = useState('');
  const [nombre, setNombre] = useState('');
  const [dni, setDni] = useState('');
  const [obs, setObs] = useState('');
  const [coords, setCoords] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [ok, setOk] = useState(null);

  useEffect(() => {
    fetch(`${API}/api/public/manifiestos/${codigo}`).then((r) => r.json()).then((d) => {
      if (d.error) setError(d.error);
      else setDatos(d);
    }).catch(() => setError('No se pudo cargar el manifiesto'));
  }, [codigo]);

  const pedirUbicacion = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setCoords(null),
      { timeout: 10000 },
    );
  };

  async function enviar(e) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const r = await fetch(`${API}/api/public/manifiestos/${codigo}/recepcion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firmaBase64: firma,
          firmanteNombre: nombre,
          firmanteDni: dni || undefined,
          lat: coords?.lat,
          lng: coords?.lng,
          observaciones: obs || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'No se pudo confirmar la recepción');
      setOk(d);
    } catch (e2) {
      setError(e2.message);
    } finally {
      setEnviando(false);
    }
  }

  if (error && !datos) return <div className="recibir-pant"><div className="card"><h2>No encontrado</h2><p className="error">{error}</p></div></div>;
  if (!datos) return <div className="recibir-pant"><p className="muted">Cargando…</p></div>;

  if (datos.estado === 'recibido' || ok) {
    return (
      <div className="recibir-pant">
        <div className="card stack">
          <h2>✓ Recepción confirmada</h2>
          <p>Manifiesto <b>{datos.numero}</b> recibido.</p>
          {ok && <p className="small muted">Fecha de confirmación: {new Date(ok.fecha).toLocaleString('es-AR')}</p>}
          {datos.recepcion && <p className="small muted">Confirmado por: {datos.recepcion.firmanteNombre}</p>}
        </div>
      </div>
    );
  }

  if (datos.estado === 'anulado') {
    return <div className="recibir-pant"><div className="card"><h2>Manifiesto anulado</h2><p className="muted">Este manifiesto fue anulado por el emisor y no puede recibirse.</p></div></div>;
  }

  const totalKg = (datos.items ?? []).reduce((a, i) => a + i.kg, 0);
  return (
    <div className="recibir-pant">
      <div className="card stack">
        <div>
          <h2>Confirmar recepción</h2>
          <p className="muted">Manifiesto <b>{datos.numero}</b> · {new Date(datos.fecha).toLocaleDateString('es-AR')}</p>
        </div>
        <div className="grid2">
          <div><b>Emisor</b><div className="small">{datos.emisor.nombre}</div></div>
          <div><b>Destino</b><div className="small">{datos.destino?.razonSocial ?? '—'}</div></div>
          {datos.transporte?.patente && <div><b>Transporte</b><div className="small">{datos.transporte.razonSocial} · Patente {datos.transporte.patente}</div></div>}
          <div><b>Total</b><div className="small">{totalKg.toLocaleString('es-AR')} kg{datos.corriente ? ` · corriente ${datos.corriente}` : ''}</div></div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Material</th><th className="r">Kg</th></tr></thead>
            <tbody>{datos.items.map((i, k) => <tr key={k}><td>{i.material?.nombre ?? '—'}</td><td className="r num">{i.kg.toLocaleString('es-AR')}</td></tr>)}</tbody>
          </table>
        </div>
        <form className="stack" onSubmit={enviar}>
          <h3>Datos del receptor</h3>
          <label>Nombre y apellido<input type="text" required value={nombre} onChange={(e) => setNombre(e.target.value)} /></label>
          <label>DNI (opcional)<input type="text" value={dni} onChange={(e) => setDni(e.target.value)} /></label>
          <label>Observaciones<input type="text" value={obs} onChange={(e) => setObs(e.target.value)} /></label>
          <div>
            <p><b>Firma</b></p>
            <Firma onChange={setFirma} />
          </div>
          <div className="row">
            <button type="button" className="secondary" onClick={pedirUbicacion}>{coords ? `Ubicación ✓ ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : 'Agregar ubicación'}</button>
          </div>
          {error && <p className="error">{error}</p>}
          <div className="row"><button type="submit" disabled={enviando || !firma || !nombre}>Confirmar recepción</button></div>
        </form>
      </div>
    </div>
  );
}
