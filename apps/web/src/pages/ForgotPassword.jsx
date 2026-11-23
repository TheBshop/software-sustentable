import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      await api('/auth/forgot-password', { method: 'POST', body: { email } });
      setSent(true);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="login-pant">
      <div className="login-form-col" style={{ margin: 'auto' }}>
        <form className="card login" onSubmit={onSubmit}>
          <h2>Restablecer contraseña</h2>
          {sent ? (
            <>
              <p style={{ color: '#16a34a' }}>Si el email existe en la plataforma, vas a recibir un enlace para restablecer tu contraseña.</p>
              <p className="muted">Revisá tu bandeja de entrada y la carpeta de spam.</p>
              <Link to="/login" className="button secondary" style={{ textAlign: 'center', marginTop: 12 }}>Volver al login</Link>
            </>
          ) : (
            <>
              <p className="muted">Ingresá tu email y te mandamos un enlace para elegir una contraseña nueva.</p>
              <label>
                Email
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </label>
              {error && <p className="error">{error}</p>}
              <button type="submit">Enviar enlace</button>
              <p style={{ textAlign: 'center', marginTop: 12 }}><Link to="/login" style={{ fontSize: 13, color: '#6b7280' }}>Volver al login</Link></p>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
