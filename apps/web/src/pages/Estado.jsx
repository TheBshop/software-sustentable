// Estado del sistema: versión, conexión a BD, storage, email, uptime. Da confianza.
import { useEffect, useState } from 'react';
import { api, descargar } from '../api.js';

export default function Estado() {
  const [estado, setEstado] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api('/api/estado').then(setEstado).catch((e) => setErr(e.message));
  }, []);

  if (err) return <div className="pant"><div className="aviso aviso-error">{err}</div></div>;
  if (!estado) return <div className="pant"><p>Cargando...</p></div>;

  const fmt = (s) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h ? `${h} h ${m} min` : `${m} min`;
  };
  const chip = (v, bueno = true) => <span className={`chip chip-${v && bueno ? 'vigente' : 'rechazado'}`}>{v ? 'OK' : 'no'}</span>;

  return (
    <div className="pant">
      <h1>Estado del sistema</h1>
      <div className="tarjeta">
        <table className="tabla">
          <tbody>
            <tr><td>Versión</td><td>{estado.version}</td></tr>
            <tr><td>Entorno</td><td>{estado.env}</td></tr>
            <tr><td>Base de datos</td><td>{chip(estado.mongo === 'conectado')} {estado.mongo}</td></tr>
            <tr><td>Storage de archivos</td><td>{estado.storage} {chip(estado.storage === 's3')}</td></tr>
            <tr><td>Envío de emails</td><td>{chip(estado.emailConfigurado)}</td></tr>
            <tr><td>Uptime del servidor</td><td>{fmt(estado.uptimeSegundos)}</td></tr>
            <tr><td>Hora del servidor</td><td>{new Date(estado.hora).toLocaleString('es-AR')}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="tarjeta" style={{ marginTop: 12 }}>
        <h2>Mis datos</h2>
        <p className="ayuda">Podés bajar en cualquier momento un ZIP con todos los datos de tu organización. Son tuyos.</p>
        <button onClick={() => descargar('/api/mi-organizacion/exportar/datos.zip', `datos-${new Date().toISOString().slice(0, 10)}.zip`)}>Descargar todos mis datos (ZIP)</button>
      </div>
    </div>
  );
}
