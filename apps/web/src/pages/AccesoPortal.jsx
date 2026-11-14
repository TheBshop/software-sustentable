import { useState } from 'react';
import { api } from '../api.js';
import { ErrorMsg } from '../ui.jsx';

/**
 * La cooperativa le da acceso al portal a un cliente generador. La contraseña se genera
 * en el servidor y se muestra UNA sola vez, para pasársela al cliente.
 */
export default function AccesoPortal({ cliente, onClose, onDone }) {
  const [form, setForm] = useState({ email: cliente.contacto?.email ?? '', nombre: cliente.contacto?.nombre ?? '', tipo: 'empresa' });
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setErr(null);
    try {
      setRes(await api(`/clientes/${cliente._id}/acceso-portal`, { method: 'POST', body: form }));
      onDone();
    } catch (e2) {
      setErr(e2.message);
    }
  }

  const mensaje = res
    ? `Hola ${res.usuario.nombre}! Ya podés ver tus retiros, certificados y facturas en el portal: ${window.location.origin}/login\nUsuario: ${res.usuario.email}\nContraseña: ${res.password}`
    : '';

  return (
    <section className="card stack">
      <div className="view-head">
        <h3>Acceso al portal · {cliente.razonSocial}</h3>
        <button type="button" className="link" onClick={onClose}>Cerrar</button>
      </div>
      {!res ? (
        <form className="stack" onSubmit={submit}>
          <p className="muted small">
            El cliente va a poder ver sus retiros, certificados, facturas y descargar el informe anual. Si otra cooperativa ya le dio acceso (mismo CUIT),
            se usa la misma cuenta y ve todo junto.
          </p>
          <div className="form-grid">
            <label>Nombre de la persona<input value={form.nombre} onChange={set('nombre')} required minLength={2} /></label>
            <label>Email<input type="email" value={form.email} onChange={set('email')} required /></label>
            <label>
              Tipo
              <select value={form.tipo} onChange={set('tipo')}>
                <option value="empresa">Empresa</option>
                <option value="municipio">Municipio (agrupa por sede)</option>
              </select>
            </label>
          </div>
          <ErrorMsg error={err} />
          <div className="row"><button type="submit">Crear acceso</button></div>
        </form>
      ) : (
        <div className="stack">
          <p className="ok">
            Acceso creado{res.vinculadaExistente ? ' (vinculado a la cuenta que ya tenía en la plataforma)' : ''}. Esta contraseña se muestra una sola vez:
          </p>
          <div className="secreto" aria-label="Contraseña generada">{res.password}</div>
          <textarea readOnly rows={4} value={mensaje} aria-label="Mensaje para enviar al cliente" style={{ width: '100%', fontFamily: 'inherit', fontSize: 13 }} />
          <div className="row">
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(mensaje).then(() => setCopiado(true)).catch(() => setCopiado(false))}
            >
              {copiado ? 'Mensaje copiado' : 'Copiar mensaje para el cliente'}
            </button>
            <button type="button" className="secondary" onClick={onClose}>Listo</button>
          </div>
        </div>
      )}
    </section>
  );
}
