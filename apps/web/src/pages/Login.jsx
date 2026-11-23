import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, setToken, setUser, esOperador } from '../api.js';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token, user } = await api('/auth/login', { method: 'POST', body: { email, password } });
      setToken(token);
      setUser(user);
      navigate(user.organizacion?.rol === 'plataforma' ? '/plataforma' : esOperador(user) ? '/panel' : '/portal');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" autoFocus />
        </label>
        <label>
          Contraseña
          <div style={{ position: 'relative' }}>
            <input type={showPwd ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" style={{ paddingRight: 44 }} />
            <button type="button" onClick={() => setShowPwd(!showPwd)} tabIndex={-1} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 4, cursor: 'pointer', fontSize: 13, color: '#6b7280' }}>{showPwd ? 'Ocultar' : 'Ver'}</button>
          </div>
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" disabled={loading}>{loading ? 'Ingresando…' : 'Ingresar'}</button>
        <p style={{ textAlign: 'center', marginTop: 12 }}><Link to="/forgot-password" style={{ fontSize: 13, color: '#6b7280' }}>Olvidé mi contraseña</Link></p>
      </form>
      </div>
    </div>
  );
}
