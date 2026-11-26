import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, setToken, setUser, esOperador } from '../api.js';

const TIPOS = [
  { value: 'cooperativa', label: 'Cooperativa' },
  { value: 'recicladora', label: 'Empresa recicladora' },
  { value: 'municipio', label: 'Municipio' },
  { value: 'vecino', label: 'Vecino / Ciudadano' },
];

export default function Register() {
  const navigate = useNavigate();
  const [f, setF] = useState({ tipo: 'cooperativa', nombre: '', cuit: '', adminNombre: '', email: '', password: '', confirm: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const passwordOk = f.password.length >= 8;
  const coinciden = f.password === f.confirm;
  const formOk = f.nombre.trim() && f.adminNombre.trim() && f.email && passwordOk && coinciden;

  const set = (k) => (e) => {
    if (k === 'tipo' && e.target.value === 'vecino') return navigate('/register-vecino');
    setF({ ...f, [k]: e.target.value });
  };

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!coinciden) return setError('Las contraseñas no coinciden');
    setLoading(true);
    try {
      const { token, user } = await api('/auth/register', {
        method: 'POST',
        body: {
          tipo: f.tipo,
          nombre: f.nombre.trim(),
          ...(f.cuit.trim() && { cuit: f.cuit.trim() }),
          admin: { nombre: f.adminNombre.trim(), email: f.email, password: f.password },
        },
      });
      setToken(token);
      setUser(user);
      navigate(esOperador(user) ? '/bienvenida' : '/panel', { replace: true });
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
        <h1>Empezá a gestionar tus residuos</h1>
        <p>Creá tu cuenta gratis y configurá tu organización en minutos. Sin tarjeta, sin compromiso.</p>
        <ul>
          <li>Registros digitales con trazabilidad completa</li>
          <li>Cumplimiento normativo según tu jurisdicción</li>
          <li>Certificados, remitos e informes listos para presentar</li>
        </ul>
      </section>
      <div className="login-form-col">
        <form className="card login" onSubmit={onSubmit}>
          <h2>Crear cuenta</h2>
          <p className="muted">Datos de tu organización y tu usuario administrador.</p>

          <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <legend style={{ fontWeight: 600, marginBottom: 4 }}>Organización</legend>
            <label>
              Tipo
              <select value={f.tipo} onChange={set('tipo')}>
                {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
            <label>
              Nombre
              <input value={f.nombre} onChange={set('nombre')} required placeholder="Ej: Cooperativa Nueva Vida" autoFocus />
            </label>
            <label>
              CUIT <span className="muted" style={{ fontWeight: 400 }}>(opcional)</span>
              <input value={f.cuit} onChange={set('cuit')} placeholder="30-12345678-9" />
            </label>
          </fieldset>

          <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <legend style={{ fontWeight: 600, marginBottom: 4 }}>Tu usuario</legend>
            <label>
              Nombre completo
              <input value={f.adminNombre} onChange={set('adminNombre')} required placeholder="Tu nombre" />
            </label>
            <label>
              Email
              <input type="email" value={f.email} onChange={set('email')} required autoComplete="email" placeholder="tu@email.com" />
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
          </fieldset>

          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" disabled={loading || !formOk}>{loading ? 'Creando cuenta…' : 'Crear cuenta'}</button>
          <p style={{ textAlign: 'center', marginTop: 12 }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>¿Ya tenés cuenta? </span>
            <Link to="/login" style={{ fontSize: 13 }}>Ingresar</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
