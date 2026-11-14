import { useState } from 'react';
import { api, fmtPeso, fmtFecha, isoDate, pad } from '../api.js';
import { useLoad, Tag, ErrorMsg, ConfirmButton } from '../ui.jsx';
import { DetalleRetiros } from './portal/Facturas.jsx';

const MODALIDADES = { por_retiro: 'por retiro', por_kg: 'por kg', abono_mensual: 'abono mensual', sin_cargo: 'sin cargo' };

export default function Facturacion() {
  const alertas = useLoad('/facturas/alertas?dias=7');
  const facturas = useLoad('/facturas');
  const reloadAll = () => Promise.all([alertas.reload(), facturas.reload()]);

  return (
    <>
      <div className="view-head">
        <div>
          <h2>Facturación y cobranza</h2>
          <p className="muted">Liquidaciones internas. La factura fiscal se emite en ARCA y se anota acá su número.</p>
        </div>
      </div>
      <Alertas data={alertas.data} error={alertas.error} />
      <NuevaLiquidacion onCreated={reloadAll} />
      <Liquidaciones data={facturas.data} error={facturas.error} onChange={reloadAll} />
    </>
  );
}

function Alertas({ data, error }) {
  if (error) return <ErrorMsg error={error} />;
  if (!data) return null;
  const filas = [...data.vencidas.map((a) => ({ ...a, tone: 'red' })), ...data.porVencer.map((a) => ({ ...a, tone: 'sun' }))];
  if (!filas.length) return <div className="strip ok-strip">No hay cobros vencidos ni por vencer en los próximos 7 días.</div>;
  return (
    <section className="card flush">
      <div className="card-head">
        <h3>Alertas de cobro</h3>
        <span className="muted small">Vencido {fmtPeso(data.totalVencido)} · por vencer {fmtPeso(data.totalPorVencer)}</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>N°</th><th>Cliente</th><th>Contacto</th><th className="r">Saldo</th><th>Vence</th><th>Situación</th></tr></thead>
          <tbody>
            {filas.map((a) => (
              <tr key={a.id}>
                <td className="mono">{pad(a.numero, 4)}</td>
                <td>{a.cliente?.razonSocial}</td>
                <td className="small">{a.cliente?.contacto?.telefono}<div className="muted">{a.cliente?.contacto?.email}</div></td>
                <td className="r num">{fmtPeso(a.saldo)}</td>
                <td className="num">{fmtFecha(a.vencimiento)}</td>
                <td>
                  <Tag tone={a.tone}>
                    {a.diasRestantes < 0 ? `Vencida hace ${-a.diasRestantes} días` : a.diasRestantes === 0 ? 'Vence hoy' : `Vence en ${a.diasRestantes} días`}
                  </Tag>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function NuevaLiquidacion({ onCreated }) {
  const clientes = useLoad('/clientes?limit=200');
  const hoy = new Date();
  const [form, setForm] = useState({ cliente: '', desde: isoDate(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: isoDate(hoy) });
  const [preview, setPreview] = useState(null);
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(null);
  const set = (k) => (e) => {
    setForm({ ...form, [k]: e.target.value });
    setPreview(null);
  };

  async function verPreview() {
    setErr(null);
    setOk(null);
    if (!form.cliente) return setErr('Elegí un cliente.');
    try {
      setPreview(await api('/facturas/preview', { method: 'POST', body: form }));
    } catch (e) {
      setErr(e.message);
    }
  }
  async function generar() {
    setErr(null);
    try {
      const f = await api('/facturas', { method: 'POST', body: form });
      setPreview(null);
      setOk(`Liquidación N° ${pad(f.numero, 4)} generada por ${fmtPeso(f.total)}.`);
      onCreated();
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <section className="card stack">
      <h3>Nueva liquidación</h3>
      <div className="form-grid">
        <label>
          Cliente
          <select value={form.cliente} onChange={set('cliente')}>
            <option value="">Elegí un cliente</option>
            {clientes.data?.items.filter((c) => c.tipo !== 'comprador').map((c) => (
              <option key={c._id} value={c._id}>{c.razonSocial} · {MODALIDADES[c.tarifa?.modalidad] ?? 'sin tarifa'}</option>
            ))}
          </select>
        </label>
        <label>Desde<input type="date" value={form.desde} onChange={set('desde')} /></label>
        <label>Hasta<input type="date" value={form.hasta} onChange={set('hasta')} /></label>
      </div>
      <div className="row"><button type="button" className="secondary" onClick={verPreview}>Ver vista previa</button></div>
      <ErrorMsg error={err} />
      {ok && <p className="ok">{ok}</p>}
      {preview && (
        <>
          <table>
            <thead><tr><th>Concepto</th><th className="r">Cantidad</th><th className="r">Precio</th><th className="r">Subtotal</th></tr></thead>
            <tbody>
              {preview.lineas.map((l) => (
                <tr key={l.descripcion}>
                  <td>{l.descripcion}</td>
                  <td className="r num">{l.cantidad.toLocaleString('es-AR')} {l.cantidad === 1 || l.unidad === 'kg' ? l.unidad : `${l.unidad}s`}</td>
                  <td className="r num">{fmtPeso(l.precioUnitario)}</td>
                  <td className="r num">{fmtPeso(l.subtotal)}</td>
                </tr>
              ))}
              {!preview.lineas.length && <tr><td colSpan={4} className="muted">No hay retiros sin facturar en el período.</td></tr>}
            </tbody>
          </table>
          <div className="total-line">
            <span>Total · {preview.retiros.length} retiro{preview.retiros.length === 1 ? '' : 's'} incluido{preview.retiros.length === 1 ? '' : 's'}</span>
            <span className="num">{fmtPeso(preview.total)}</span>
          </div>
          {preview.detalle?.length > 0 && (
            <details>
              <summary className="small">Ver el detalle retiro por retiro (lo verá el cliente en su portal)</summary>
              <DetalleRetiros detalle={preview.detalle} />
            </details>
          )}
          {preview.total > 0 && <div className="row"><button type="button" onClick={generar}>Generar liquidación</button></div>}
        </>
      )}
    </section>
  );
}

function Liquidaciones({ data, error, onChange }) {
  const [abierto, setAbierto] = useState(null); // { id, tipo: 'pago' | 'fiscal' | 'detalle' }
  return (
    <section className="card flush">
      <div className="card-head"><h3>Liquidaciones emitidas</h3></div>
      <ErrorMsg error={error} />
      <div className="table-wrap">
        <table>
          <thead><tr><th>N°</th><th>Cliente</th><th className="r">Total</th><th className="r">Saldo</th><th>Vence</th><th>Estado</th><th>Factura ARCA</th><th>Acciones</th></tr></thead>
          <tbody>
            {data?.items.map((f) => [
              <tr key={f._id}>
                <td className="mono">{pad(f.numero, 4)}</td>
                <td>{f.cliente?.razonSocial}<div className="muted small">{fmtFecha(f.periodo?.desde)} al {fmtFecha(f.periodo?.hasta)}</div></td>
                <td className="r num">{fmtPeso(f.total)}</td>
                <td className="r num">{fmtPeso(f.saldo)}</td>
                <td className="num">{fmtFecha(f.vencimiento)}</td>
                <td>
                  {f.estado === 'pagada' && <Tag tone="green">Pagada</Tag>}
                  {f.estado === 'anulada' && <Tag>Anulada</Tag>}
                  {f.estado === 'pendiente' && (f.vencida ? <Tag tone="red">Vencida</Tag> : <Tag tone="sun">Pendiente</Tag>)}
                </td>
                <td className="small">
                  {f.comprobanteFiscal?.numero ? (
                    <span className="mono">{f.comprobanteFiscal.tipo} {pad(f.comprobanteFiscal.puntoVenta, 4)}-{pad(f.comprobanteFiscal.numero, 8)}</span>
                  ) : f.estado !== 'anulada' ? (
                    <button type="button" className="link" onClick={() => setAbierto({ id: f._id, tipo: 'fiscal' })}>Anotar</button>
                  ) : '—'}
                </td>
                <td>
                  <div className="actions">
                    <button type="button" className="link" onClick={() => setAbierto(abierto?.id === f._id && abierto.tipo === 'detalle' ? null : { id: f._id, tipo: 'detalle' })}>Detalle</button>
                  </div>
                  {f.estado === 'pendiente' && (
                    <div className="actions">
                      <button type="button" className="secondary sm" onClick={() => setAbierto({ id: f._id, tipo: 'pago' })}>Registrar pago</button>
                      {!f.pagos.length && <ConfirmButton onConfirm={() => api(`/facturas/${f._id}/anular`, { method: 'POST' }).then(onChange)} confirmLabel="Sí, anular">Anular</ConfirmButton>}
                    </div>
                  )}
                </td>
              </tr>,
              abierto?.id === f._id && (
                <tr key={`${f._id}-form`} className="edit-row">
                  <td colSpan={8}>
                    {abierto.tipo === 'detalle' ? (
                      <DetalleRetiros detalle={f.detalle} lineas={f.lineas} />
                    ) : abierto.tipo === 'pago' ? (
                      <PagoForm factura={f} onDone={() => { setAbierto(null); onChange(); }} onCancel={() => setAbierto(null)} />
                    ) : (
                      <FiscalForm factura={f} onDone={() => { setAbierto(null); onChange(); }} onCancel={() => setAbierto(null)} />
                    )}
                  </td>
                </tr>
              ),
            ])}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PagoForm({ factura, onDone, onCancel }) {
  const [monto, setMonto] = useState(String(factura.saldo));
  const [medio, setMedio] = useState('transferencia');
  const [fecha, setFecha] = useState(isoDate());
  const [err, setErr] = useState(null);
  async function submit(e) {
    e.preventDefault();
    if (!(Number(monto) > 0)) return setErr('El monto tiene que ser mayor a cero.');
    try {
      await api(`/facturas/${factura._id}/pagos`, { method: 'POST', body: { monto: Number(monto), medio, fecha } });
      onDone();
    } catch (e2) {
      setErr(e2.message);
    }
  }
  return (
    <form className="edit-grid" onSubmit={submit}>
      <label>Monto ($)<input type="number" min="1" step="any" value={monto} onChange={(e) => setMonto(e.target.value)} autoFocus /></label>
      <label>Fecha<input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
      <label>Medio
        <select value={medio} onChange={(e) => setMedio(e.target.value)}>
          <option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option><option value="cheque">Cheque</option>
        </select>
      </label>
      <div className="row"><button type="submit">Guardar pago</button><button type="button" className="secondary" onClick={onCancel}>Cancelar</button></div>
      <ErrorMsg error={err} />
    </form>
  );
}

function FiscalForm({ factura, onDone, onCancel }) {
  const [f, setF] = useState({ tipo: factura.clienteSnapshot?.condicionIva === 'responsable_inscripto' ? 'A' : 'B', puntoVenta: '', numero: '', cae: '' });
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    try {
      await api(`/facturas/${factura._id}/comprobante`, {
        method: 'PATCH',
        body: { tipo: f.tipo, puntoVenta: Number(f.puntoVenta), numero: Number(f.numero), ...(f.cae && { cae: f.cae.trim() }) },
      });
      onDone();
    } catch (e2) {
      setErr(e2.message);
    }
  }
  return (
    <form className="edit-grid" onSubmit={submit}>
      <label>Tipo<select value={f.tipo} onChange={set('tipo')}><option>A</option><option>B</option><option>C</option></select></label>
      <label>Punto de venta<input type="number" min="1" value={f.puntoVenta} onChange={set('puntoVenta')} required autoFocus /></label>
      <label>Número<input type="number" min="1" value={f.numero} onChange={set('numero')} required /></label>
      <label>CAE (opcional)<input value={f.cae} onChange={set('cae')} inputMode="numeric" placeholder="14 dígitos" /></label>
      <div className="row"><button type="submit">Guardar</button><button type="button" className="secondary" onClick={onCancel}>Cancelar</button></div>
      <ErrorMsg error={err} />
    </form>
  );
}
