import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api('/auth/forgot-password', { method: 'POST', body: { email } });
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-pant">
      <div className="login-form-col" style={{ margin: 'auto' }}>
        <form className="card login" onSubmit={onSubmit}>
          <h2>Restablecer contraseña</h2>
          {sent ? (
            <>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '16px 20px', marginBottom: 12 }}>
                <p style={{ color: '#16a34a', margin: 0, fontWeight: 500 }}>Revisá tu email</p>
                <p style={{ color: '#15803d', margin: '8px 0 0', fontSize: 14 }}>Si <strong>{email}</strong> está registrado en la plataforma, vas a recibir un enlace para elegir una contraseña nueva.</p>
              </div>
              <p className="muted" style={{ fontSize: 13 }}>Revisá también la carpeta de spam o correo no deseado. El enlace es válido por 1 hora.</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <Link to="/login" className="button secondary" style={{ textAlign: 'center', flex: 1 }}>Volver al login</Link>
                <button type="button" className="secondary" style={{ flex: 1 }} onClick={() => { setSent(false); setEmail(''); }}>Pedir otro enlace</button>
              </div>
            </>
          ) : (
            <>
              <p className="muted">Ingresá tu email y te mandamos un enlace para elegir una contraseña nueva.</p>
              <label>
                Email
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" autoFocus />
              </label>
              {error && <p className="error" role="alert">{error}</p>}
              <button type="submit" disabled={loading}>{loading ? 'Enviando…' : 'Enviar enlace'}</button>
              <p style={{ textAlign: 'center', marginTop: 12 }}><Link to="/login" style={{ fontSize: 13, color: '#6b7280' }}>Volver al login</Link></p>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
