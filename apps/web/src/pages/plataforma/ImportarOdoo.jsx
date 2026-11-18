import { useState } from 'react';
import { apiForm } from '../../api.js';

const TIPOS = [
  { id: 'contactos', titulo: 'Contactos (res.partner)', ayuda: 'Columnas Odoo: name, vat, customer_rank, supplier_rank, email, phone, street, city' },
  { id: 'productos', titulo: 'Productos (product.product)', ayuda: 'Columnas Odoo: name, default_code, list_price, categ_id/name' },
  { id: 'facturas', titulo: 'Facturas (account.move)', ayuda: 'Columnas Odoo: name, invoice_date, partner_id/vat, amount_total, payment_state' },
];

export function ImportarOdoo() {
  const [tipo, setTipo] = useState('contactos');
  const [archivo, setArchivo] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');

  async function subir(e) {
    e.preventDefault();
    if (!archivo) return;
    setSubiendo(true);
    setError('');
    setResumen(null);
    try {
      const form = new FormData();
      form.append('archivo', archivo);
      const r = await apiForm(`/api/import/odoo/${tipo}`, form);
      setResumen(r);
    } catch (err) {
      setError(err.message || 'Error al importar');
    } finally {
      setSubiendo(false);
    }
  }

  const info = TIPOS.find((t) => t.id === tipo);

  return (
    <div className="pant pant-ancha">
      <h1>Importar desde Odoo</h1>
      <p className="ayuda-pant">Subí los CSV exportados desde Odoo (Lista → Exportar). El importador detecta ; o , y acepta las columnas estándar.</p>

      <form onSubmit={subir} className="tarjeta">
        <label>Tipo de dato
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS.map((t) => (<option key={t.id} value={t.id}>{t.titulo}</option>))}
          </select>
        </label>
        <p className="ayuda">{info.ayuda}</p>
        <label>Archivo CSV
          <input type="file" accept=".csv,text/csv,text/plain" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
        </label>
        <button type="submit" disabled={!archivo || subiendo}>{subiendo ? 'Procesando...' : 'Importar'}</button>
      </form>

      {error && <div className="aviso aviso-error">{error}</div>}
      {resumen && (
        <div className="tarjeta" style={{ marginTop: 12 }}>
          <h2>Resultado</h2>
          <ul>
            <li><strong>Creados:</strong> {resumen.creados}</li>
            <li><strong>Actualizados:</strong> {resumen.actualizados}</li>
            <li><strong>Errores:</strong> {resumen.errores.length}</li>
          </ul>
          {resumen.errores.length > 0 && (
            <table className="tabla">
              <thead><tr><th>Fila</th><th>Motivo</th></tr></thead>
              <tbody>{resumen.errores.map((e, i) => (<tr key={i}><td>{e.fila}</td><td>{e.msg}</td></tr>))}</tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
