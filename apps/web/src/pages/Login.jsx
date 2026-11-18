import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken, setUser, esOperador } from '../api.js';

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
      navigate(user.organizacion?.rol === 'plataforma' ? '/plataforma' : esOperador(user) ? '/panel' : '/portal');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="login-pant">
      <section className="login-hero">
        <span className="eyebrow">Gestión RSU</span>
        <h1>Gestión legal de residuos, en orden y al día</h1>
        <p>Para cooperativas, empresas recicladoras y municipios: registros, trazabilidad y cumplimiento según tu actividad y tu jurisdicción.</p>
        <ul>
          <li>Registros de cada día, con quién cargó qué</li>
          <li>Obligaciones nacionales, provinciales y municipales</li>
          <li>Certificados, remitos e informes para presentar</li>
        </ul>
      </section>
      <div className="login-form-col">
      <form className="card login" onSubmit={onSubmit}>
        <h2>Ingresar</h2>
        <p className="muted">Con el usuario que te dio tu organización.</p>
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
    </div>
  );
}
