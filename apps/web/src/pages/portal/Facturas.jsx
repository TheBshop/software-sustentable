import { useState } from 'react';
import { fmtPeso, fmtKg, fmtFecha, pad } from '../../api.js';
import { useLoad, ErrorMsg, Tag } from '../../ui.jsx';

/** Tabla de qué se cobró por cada retiro. La usan el portal y la facturación de la cooperativa. */
export function DetalleRetiros({ detalle, lineas }) {
  if (!detalle?.length) {
    return <p className="muted small">Esta liquidación no tiene detalle por retiro (es anterior al detalle o es un abono).{lineas?.length ? ` Conceptos: ${lineas.map((l) => l.descripcion).join(', ')}.` : ''}</p>;
  }
  return (
    <table className="detalle">
      <thead><tr><th>Retiro</th><th>Fecha</th><th>Sede</th><th className="r">Kilos</th><th className="r">Importe</th></tr></thead>
      <tbody>
        {detalle.map((d) => (
          <tr key={d.numero}>
            <td className="mono">{pad(d.numero)}</td>
            <td className="num">{fmtFecha(d.fecha)}</td>
            <td className="small">{d.sede ?? '—'}</td>
            <td className="r num">{fmtKg(d.kg)}</td>
            <td className="r num">{d.importe == null ? 'incluido en el abono' : fmtPeso(d.importe)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function PortalFacturas() {
  const { data, error } = useLoad('/v1/portal/facturas');
  const [abierta, setAbierta] = useState(null);
  const items = data?.items ?? [];
  const vencidas = items.filter((f) => f.vencida);
  const deuda = items.filter((f) => f.estado === 'pendiente').reduce((a, f) => a + f.saldo, 0);

  return (
    <>
      <div className="view-head">
        <div>
          <h2>Facturas</h2>
          <p className="muted">Saldo pendiente: {fmtPeso(deuda)}</p>
        </div>
      </div>
      {vencidas.length > 0 && (
        <div className="strip alert-strip">
          Tenés {vencidas.length} {vencidas.length === 1 ? 'factura vencida' : 'facturas vencidas'} por {fmtPeso(vencidas.reduce((a, f) => a + f.saldo, 0))}. Comunicate con la cooperativa para regularizarlo.
        </div>
      )}
      <ErrorMsg error={error} />
      <div className="card flush">
        <div className="table-wrap">
          <table>
            <thead><tr><th>N°</th><th>Cooperativa</th><th>Período</th><th className="r">Total</th><th className="r">Saldo</th><th>Vence</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {items.map((f) => [
                <tr key={f.id}>
                  <td className="mono">{pad(f.numero, 4)}</td>
                  <td className="small">{f.cooperativa}</td>
                  <td className="small">{fmtFecha(f.periodo?.desde)} al {fmtFecha(f.periodo?.hasta)}</td>
                  <td className="r num">{fmtPeso(f.total)}</td>
                  <td className="r num">{fmtPeso(f.saldo)}</td>
                  <td className="num">{fmtFecha(f.vencimiento)}</td>
                  <td>{f.estado === 'pagada' ? <Tag tone="green">Pagada</Tag> : f.vencida ? <Tag tone="red">Vencida</Tag> : <Tag tone="sun">Pendiente</Tag>}</td>
                  <td>
                    <button type="button" className="link" onClick={() => setAbierta(abierta === f.id ? null : f.id)} aria-expanded={abierta === f.id}>
                      {abierta === f.id ? 'Ocultar detalle' : 'Ver detalle'}
                    </button>
                  </td>
                </tr>,
                abierta === f.id && (
                  <tr key={`${f.id}-d`} className="edit-row">
                    <td colSpan={8}>
                      <DetalleRetiros detalle={f.detalle} lineas={f.lineas} />
                      {f.comprobanteFiscal && (
                        <p className="muted small">
                          Factura ARCA {f.comprobanteFiscal.tipo} {pad(f.comprobanteFiscal.puntoVenta, 4)}-{pad(f.comprobanteFiscal.numero, 8)}
                          {f.comprobanteFiscal.cae && ` · CAE ${f.comprobanteFiscal.cae}`}
                        </p>
                      )}
                    </td>
                  </tr>
                ),
              ])}
              {!items.length && <tr><td colSpan={8} className="muted">No hay facturas.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
