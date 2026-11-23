import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) return setError('Las contraseñas no coinciden');
    try {
      await api('/auth/reset-password', { method: 'POST', body: { token, password } });
      setDone(true);
    } catch (err) {
      setError(err.message);
    }
  }

  if (!token) return (
    <div className="login-pant">
      <div className="login-form-col" style={{ margin: 'auto' }}>
        <div className="card login">
          <h2>Enlace inválido</h2>
          <p>El enlace no tiene un token válido. Pedí uno nuevo desde el login.</p>
          <Link to="/forgot-password" className="button secondary" style={{ textAlign: 'center' }}>Pedir nuevo enlace</Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className="login-pant">
      <div className="login-form-col" style={{ margin: 'auto' }}>
        <form className="card login" onSubmit={onSubmit}>
          <h2>Nueva contraseña</h2>
          {done ? (
            <>
              <p style={{ color: '#16a34a' }}>Contraseña cambiada. Ya podés ingresar.</p>
              <Link to="/login" className="button primary" style={{ textAlign: 'center', marginTop: 12 }}>Ingresar</Link>
            </>
          ) : (
            <>
              <p className="muted">Elegí una contraseña nueva (mínimo 8 caracteres).</p>
              <label>
                Nueva contraseña
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
              </label>
              <label>
                Repetir contraseña
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
              </label>
              {error && <p className="error">{error}</p>}
              <button type="submit">Cambiar contraseña</button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
