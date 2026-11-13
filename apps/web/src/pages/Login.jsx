import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../api.js';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      const { token } = await api('/auth/login', { method: 'POST', body: { email, password } });
      setToken(token);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="center">
      <form className="card login" onSubmit={onSubmit}>
        <h2>♻ Cooperativa Nueva Vida</h2>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Contraseña
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit">Ingresar</button>
      </form>
    </div>
  );
}
