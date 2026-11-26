import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, setToken, setUser } from '../api.js';

const PROVINCIAS = [
  'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes',
  'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones',
  'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe',
  'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
];

export default function RegisterVecino() {
  const navigate = useNavigate();
  const [f, setF] = useState({ nombre: '', email: '', password: '', confirm: '', provincia: '', municipio: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const passwordOk = f.password.length >= 8;
  const coinciden = f.password === f.confirm;
  const formOk = f.nombre.trim() && f.email && f.provincia && passwordOk && coinciden;

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!coinciden) return setError('Las contraseñas no coinciden');
    setLoading(true);
    try {
      const { token, user } = await api('/auth/register-vecino', {
        method: 'POST',
        body: {
          nombre: f.nombre.trim(),
          email: f.email,
          password: f.password,
          provincia: f.provincia,
          ...(f.municipio.trim() && { municipio: f.municipio.trim() }),
        },
      });
      setToken(token);
      setUser(user);
      navigate('/vecino', { replace: true });
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
        <h1>Sumate como vecino</h1>
        <p>Sacale foto a tus residuos y te decimos cómo separarlos. Gratis, sin compromiso.</p>
        <ul>
          <li>Identificación automática de residuos con IA</li>
          <li>Guía de reciclaje personalizada</li>
          <li>Historial de reportes y ubicación</li>
        </ul>
      </section>
      <div className="login-form-col">
        <form className="card login" onSubmit={onSubmit}>
          <h2>Crear cuenta vecino</h2>
          <p className="muted">Registrate para empezar a identificar y separar tus residuos.</p>

          <label>
            Nombre completo
            <input value={f.nombre} onChange={set('nombre')} required placeholder="Tu nombre" autoFocus />
          </label>
          <label>
            Email
            <input type="email" value={f.email} onChange={set('email')} required autoComplete="email" placeholder="tu@email.com" />
          </label>
          <label>
            Provincia
            <select value={f.provincia} onChange={set('provincia')} required>
              <option value="">Elegí tu provincia</option>
              {PROVINCIAS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label>
            Municipio <span className="muted" style={{ fontWeight: 400 }}>(opcional)</span>
            <input value={f.municipio} onChange={set('municipio')} placeholder="Ej: Paraná" />
          </label>
          <label>
            Contraseña
            <div style={{ position: 'relative' }}>
              <input type={showPwd ? 'text' : 'password'} value={f.password} onChange={set('password')} required minLength={8} autoComplete="new-password" style={{ paddingRight: 44 }} />
              <button type="button" onClick={() => setShowPwd(!showPwd)} tabIndex={-1} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 4, cursor: 'pointer', fontSize: 13, color: '#6b7280' }}>{showPwd ? 'Ocultar' : 'Ver'}</button>
            </div>
          </label>
          {f.password && !passwordOk && <p style={{ fontSize: 12, color: '#dc2626', margin: '2px 0 0' }}>Mínimo 8 caracteres</p>}
          <label>
            Repetir contraseña
            <input type={showPwd ? 'text' : 'password'} value={f.confirm} onChange={set('confirm')} required minLength={8} autoComplete="new-password" />
          </label>
          {f.confirm && !coinciden && <p style={{ fontSize: 12, color: '#dc2626', margin: '2px 0 0' }}>Las contraseñas no coinciden</p>}

          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" disabled={loading || !formOk}>{loading ? 'Creando cuenta…' : 'Crear cuenta'}</button>
          <p style={{ textAlign: 'center', marginTop: 12 }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>¿Ya tenés cuenta? </span>
            <Link to="/login" style={{ fontSize: 13 }}>Ingresar</Link>
            <span style={{ fontSize: 13, color: '#6b7280' }}> · </span>
            <Link to="/register" style={{ fontSize: 13 }}>Registrar organización</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
