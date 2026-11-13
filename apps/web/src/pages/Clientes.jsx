import { useEffect, useState } from 'react';
import { api, fmtPeso } from '../api.js';
import { ConfirmButton } from '../ui.jsx';

const VACIO = { tipo: 'generador', razonSocial: '', cuit: '', email: '', telefono: '', direccion: '', modalidad: 'por_retiro', montoFijo: 0 };
const TIPOS = { generador: 'Generador', comprador: 'Comprador', ambos: 'Generador y comprador' };
const MODALIDADES = { por_retiro: 'Por retiro', por_kg: 'Por kg', abono_mensual: 'Abono mensual', sin_cargo: 'Sin cargo' };

export default function Clientes() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState(VACIO);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState(null);

  const load = () => api(`/clientes?q=${encodeURIComponent(q)}`).then((r) => setItems(r.items));
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [q]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  function edit(c) {
    setEditId(c._id);
    setForm({
      tipo: c.tipo ?? 'generador',
      direccion: c.direcciones?.[0]?.direccion ?? '',
      razonSocial: c.razonSocial,
      cuit: c.cuit ?? '',
      email: c.contacto?.email ?? '',
      telefono: c.contacto?.telefono ?? '',
      modalidad: c.tarifa?.modalidad ?? 'por_retiro',
      montoFijo: c.tarifa?.montoFijo ?? 0,
    });
  }

  async function save(e) {
    e.preventDefault();
    setError(null);
    const body = {
      tipo: form.tipo,
      ...(form.direccion.trim() && { direcciones: [{ direccion: form.direccion.trim() }] }),
      razonSocial: form.razonSocial,
      ...(form.cuit && { cuit: form.cuit }),
      contacto: { ...(form.email && { email: form.email }), ...(form.telefono && { telefono: form.telefono }) },
      tarifa: { modalidad: form.modalidad, montoFijo: Number(form.montoFijo) },
    };
    try {
      await api(editId ? `/clientes/${editId}` : '/clientes', { method: editId ? 'PATCH' : 'POST', body });
      setForm(VACIO);
      setEditId(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    await api(`/clientes/${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <>
      <h2>Clientes</h2>
      <div className="grid2">
        <section className="card">
          <input placeholder="Buscar por razón social o CUIT…" value={q} onChange={(e) => setQ(e.target.value)} />
          <table>
            <thead>
              <tr><th>Razón social</th><th>CUIT</th><th>Tarifa</th><th /></tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c._id}>
                  <td>
                    {c.razonSocial}
                    <div className="muted small">{TIPOS[c.tipo]}{c.direcciones?.[0] && ` · ${c.direcciones[0].direccion}`}</div>
                  </td>
                  <td>{c.cuit}</td>
                  <td>
                    {MODALIDADES[c.tarifa?.modalidad]}
                    {c.tarifa?.montoFijo ? ` · ${fmtPeso(c.tarifa.montoFijo)}` : ''}
                  </td>
                  <td className="actions">
                    <button className="link" onClick={() => edit(c)}>Editar</button>
                    <ConfirmButton onConfirm={() => remove(c._id)} confirmLabel="Sí, dar de baja">Baja</ConfirmButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <form className="card" onSubmit={save}>
          <h3>{editId ? 'Editar cliente' : 'Nuevo cliente'}</h3>
          <label>
            Tipo
            <select value={form.tipo} onChange={set('tipo')}>
              {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label>Razón social<input value={form.razonSocial} onChange={set('razonSocial')} required /></label>
          <label>Dirección de retiro<input value={form.direccion} onChange={set('direccion')} /></label>
          <label>CUIT<input value={form.cuit} onChange={set('cuit')} placeholder="30-12345678-9" /></label>
          <label>Email<input type="email" value={form.email} onChange={set('email')} /></label>
          <label>WhatsApp<input value={form.telefono} onChange={set('telefono')} placeholder="5493434..." /></label>
          <label>
            Modalidad de cobro
            <select value={form.modalidad} onChange={set('modalidad')}>
              {Object.entries(MODALIDADES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          {['por_retiro', 'abono_mensual'].includes(form.modalidad) && (
            <label>Monto ($)<input type="number" min="0" step="any" value={form.montoFijo} onChange={set('montoFijo')} /></label>
          )}
          {error && <p className="error">{error}</p>}
          <div className="row">
            <button type="submit">Guardar</button>
            {editId && <button type="button" className="secondary" onClick={() => { setEditId(null); setForm(VACIO); }}>Cancelar</button>}
          </div>
        </form>
      </div>
    </>
  );
}
