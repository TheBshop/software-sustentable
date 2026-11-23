import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const passwordOk = password.length >= 8;
  const coinciden = password === confirm;

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!coinciden) return setError('Las contraseñas no coinciden');
    setLoading(true);
    try {
      await api('/auth/reset-password', { method: 'POST', body: { token, password } });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '16px 20px' }}>
              <p style={{ color: '#16a34a', margin: 0, fontWeight: 500 }}>Contraseña cambiada</p>
              <p style={{ color: '#15803d', margin: '8px 0 0', fontSize: 14 }}>Ya podés ingresar con tu contraseña nueva.</p>
              <Link to="/login" className="button primary" style={{ textAlign: 'center', marginTop: 16, display: 'block' }}>Ingresar</Link>
            </div>
          ) : (
            <>
              <p className="muted">Elegí una contraseña nueva (mínimo 8 caracteres).</p>
              <label>
                Nueva contraseña
                <div style={{ position: 'relative' }}>
                  <input type={showPwd ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" autoFocus style={{ paddingRight: 44 }} />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} tabIndex={-1} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 4, cursor: 'pointer', fontSize: 13, color: '#6b7280' }}>{showPwd ? 'Ocultar' : 'Ver'}</button>
                </div>
              </label>
              {password && !passwordOk && <p style={{ fontSize: 12, color: '#dc2626', margin: '2px 0 0' }}>Mínimo 8 caracteres</p>}
              <label>
                Repetir contraseña
                <input type={showPwd ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
              </label>
              {confirm && !coinciden && <p style={{ fontSize: 12, color: '#dc2626', margin: '2px 0 0' }}>Las contraseñas no coinciden</p>}
              {error && <p className="error" role="alert">{error}</p>}
              <button type="submit" disabled={loading || !passwordOk || !coinciden}>{loading ? 'Cambiando…' : 'Cambiar contraseña'}</button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
