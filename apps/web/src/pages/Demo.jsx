import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setToken, setUser } from '../api.js';

const BASE = import.meta.env.VITE_API_URL ?? '';

/**
 * Selector de prototipos (solo con la API en modo demostración: npm run dev:demo).
 * Entra como administrador o chofer del prototipo elegido, sin contraseña.
 */
export default function Demo() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${BASE}/api/demo/prototipos`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('El modo demostración no está activo. Levantá la API con npm run dev:demo.'))))
      .then((d) => setItems(d.items))
      .catch((e) => setError(e.message));
  }, []);

  async function entrar(slug, rol = 'admin') {
    setError(null);
    const r = await fetch(`${BASE}/api/demo/entrar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, rol }) });
    const d = await r.json();
    if (!r.ok) return setError(d.error ?? 'No se pudo entrar');
    setToken(d.token);
    setUser(d.user);
    navigate('/');
  }

  const q = filtro.trim().toLowerCase();
  const visibles = (items ?? []).filter((e) => !q || `${e.nombre} ${e.ciudad} ${e.provincia}`.toLowerCase().includes(q));
  const grupos = {};
  for (const e of visibles) (grupos[e.provincia ?? 'Otras'] ??= []).push(e);
  const porProvincia = Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="demo">
      <div className="view-head">
        <div>
          <h2>♻ Prototipos por organización</h2>
          <p className="muted">Cada uno tiene los materiales que recibe la organización, el marco normativo de su provincia y su municipio, y datos de ejemplo.</p>
        </div>
        <input aria-label="Buscar" placeholder="Buscar por nombre, ciudad o provincia" value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ maxWidth: 320 }} />
      </div>
      {error && <p className="error">{error}</p>}
      {!items && !error && <p>Cargando…</p>}
      {porProvincia.map(([provincia, lista]) => (
        <section key={provincia} className="stack" style={{ gap: 8 }}>
          <h3>{provincia}</h3>
          <div className="demo-grid">
            {lista.map((e) => (
              <article key={e.slug} className="card demo-card">
                <strong>{e.nombre}</strong>
                <span className="muted small">{e.perfil} · {e.ciudad} · {e.materiales} materiales</span>
                <div className="row">
                  <button type="button" className="sm" onClick={() => entrar(e.slug)}>Entrar al panel</button>
                  <button type="button" className="secondary sm" onClick={() => entrar(e.slug, 'chofer')} title="Para abrir la app del chofer con este usuario">Usuario chofer</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
