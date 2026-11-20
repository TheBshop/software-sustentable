// Primer ingreso: obliga a cambiar la contraseña temporal recibida por canal seguro.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getUser, setUser } from '../api.js';

export default function PrimerIngreso() {
  const user = getUser();
  const nav = useNavigate();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [nueva2, setNueva2] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (nueva !== nueva2) return setError('Las contraseñas no coinciden');
    if (nueva.length < 8) return setError('Mínimo 8 caracteres');
    setGuardando(true);
    try {
      await api('/auth/cambiar-password', { method: 'POST', body: { actual, nueva } });
      setUser({ ...user, debeCambiarPassword: false });
      nav('/', { replace: true });
    } catch (err) {
      setError(err.message || 'No se pudo cambiar la contraseña');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="pant pant-centrada">
      <div className="tarjeta" style={{ maxWidth: 420 }}>
        <h1>Bienvenido, {user?.nombre?.split(' ')[0] || ''}</h1>
        <p className="ayuda-pant">Antes de empezar tenés que cambiar la contraseña temporal por una propia. Nadie, ni nosotros, va a volver a conocerla.</p>
        <form onSubmit={submit}>
          <label>Contraseña temporal recibida
            <input type="password" value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" required />
          </label>
          <label>Contraseña nueva (mínimo 8 caracteres)
            <input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" required />
          </label>
          <label>Repetila
            <input type="password" value={nueva2} onChange={(e) => setNueva2(e.target.value)} autoComplete="new-password" required />
          </label>
          {error && <div className="aviso aviso-error">{error}</div>}
          <button type="submit" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar y entrar'}</button>
        </form>
      </div>
    </div>
  );
}
