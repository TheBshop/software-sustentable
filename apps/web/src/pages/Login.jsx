import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken, setUser } from '../api.js';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      const { token, user } = await api('/auth/login', { method: 'POST', body: { email, password } });
      setToken(token);
      setUser(user);
      // Cooperativas → panel de gestión. Empresas y municipios → portal.
      navigate(user.organizacion.tipo === 'cooperativa' ? '/' : '/portal');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="center">
      <form className="card login" onSubmit={onSubmit}>
        <h2>♻ Gestión de residuos</h2>
        <p className="muted">Cooperativas, empresas y municipios ingresan con su usuario.</p>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label>
          Contraseña
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit">Ingresar</button>
      </form>
    </div>
  );
}
