import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, openPdf, fmtKg, fmtFecha, fmtFechaCorta, pad } from '../api.js';
import { useLoad, Tag, ErrorMsg, ConfirmButton } from '../ui.jsx';

export default function Certificados() {
  const { data, error, reload } = useLoad('/certificados');
  const [params, setParams] = useSearchParams();
  const certs = data?.items ?? [];
  const cert = certs.find((c) => c._id === params.get('id')) ?? certs[0];

  return (
    <>
      <div className="view-head">
        <div>
          <h2>Certificados</h2>
          <p className="muted">{certs.length} emitidos</p>
        </div>
      </div>
      <ErrorMsg error={error} />
      {!certs.length && !error && <p className="muted">Todavía no hay certificados. Se emiten desde Retiros.</p>}
      {cert && (
        <div className="split">
          <ul className="list" aria-label="Certificados">
            {certs.map((c) => (
              <li key={c._id}>
                <button type="button" className={`list-item ${c._id === cert._id ? 'active' : ''}`} onClick={() => setParams({ id: c._id })}>
                  <span className="mono">N° {pad(c.numero, 6)}</span> {c.anulado && <Tag tone="red">Anulado</Tag>}
                  <br />
                  {c.clienteSnapshot?.razonSocial}
                  <br />
                  <span className="muted small">{fmtFechaCorta(c.fechaRetiro)} · {fmtKg(c.totalKg)}</span>
                </button>
              </li>
            ))}
          </ul>
          <Detalle key={cert._id} cert={cert} onChange={reload} />
        </div>
      )}
    </>
  );
}

function Detalle({ cert, onChange }) {
  const cliente = useLoad(`/clientes/${cert.cliente}`);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const contacto = cliente.data?.contacto ?? {};

  async function run(fn) {
    setErr(null);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setErr(e.message);
    }
  }

  const whatsapp = () =>
    run(async () => {
      const win = window.open('', '_blank'); // en el click, para que no lo bloquee el navegador
      const { link } = await api(`/certificados/${cert._id}/enviar`, { method: 'POST', body: { canal: 'whatsapp', destino: contacto.telefono } });
      if (win) win.location.href = link;
      setMsg('Se abrió WhatsApp con el mensaje listo para enviar.');
      onChange();
    });
  const email = () =>
    run(async () => {
      await api(`/certificados/${cert._id}/enviar`, { method: 'POST', body: { canal: 'email', destino: contacto.email } });
      setMsg(`Enviado a ${contacto.email}.`);
      onChange();
    });
  const anular = () =>
    run(async () => {
      await api(`/certificados/${cert._id}/anular`, { method: 'POST' });
      onChange();
    });

  return (
    <div className="card stack">
      <div className="view-head">
        <div>
          <h3>Certificado N° {pad(cert.numero, 6)}</h3>
          <p className="muted">
            {cert.clienteSnapshot?.razonSocial} · CUIT {cert.clienteSnapshot?.cuit ?? '—'} · retiro del {fmtFecha(cert.fechaRetiro)}
          </p>
        </div>
        {cert.anulado ? <Tag tone="red">Anulado</Tag> : <Tag tone="green">Válido</Tag>}
      </div>

      <div className="kpis">
        <div className="kpi"><span>Material recuperado</span><strong>{fmtKg(cert.totalKg)}</strong></div>
        <div className="kpi green"><span>CO₂ evitado</span><strong>{fmtKg(cert.co2EvitadoKg)}</strong></div>
      </div>

      <table>
        <thead><tr><th>Material</th><th className="r">Peso</th><th className="r">CO₂ evitado</th></tr></thead>
        <tbody>
          {cert.materiales.map((m) => (
            <tr key={m.nombre}>
              <td>{m.nombre}{m.pesoEstimado && <span className="muted"> (estimado)</span>}</td>
              <td className="r num">{fmtKg(m.pesoKg)}</td>
              <td className="r num">{fmtKg(m.co2EvitadoKg)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="row">
        <button type="button" onClick={() => run(() => openPdf(`/certificados/${cert._id}/pdf`))}>Ver PDF</button>
        <a className="button secondary" href={`/verificar/${cert.codigo}`} target="_blank" rel="noreferrer">Página pública (QR)</a>
        {!cert.anulado && (
          <>
            <button type="button" className="secondary" onClick={whatsapp} disabled={!contacto.telefono} title={contacto.telefono ? '' : 'El cliente no tiene WhatsApp cargado'}>Enviar por WhatsApp</button>
            <button type="button" className="secondary" onClick={email} disabled={!contacto.email} title={contacto.email ? '' : 'El cliente no tiene email cargado'}>Enviar por email</button>
            <ConfirmButton onConfirm={anular} confirmLabel="Sí, anular">Anular</ConfirmButton>
          </>
        )}
      </div>
      {!cert.anulado && !contacto.telefono && !contacto.email && cliente.data && (
        <p className="muted small">El cliente no tiene WhatsApp ni email cargados. Completalos en Clientes para poder enviar el certificado.</p>
      )}
      {msg && <p className="ok">{msg}</p>}
      <ErrorMsg error={err} />

      <div>
        <p className="muted small">Código de verificación: <span className="mono">{cert.codigo}</span></p>
        {cert.envios?.length > 0 && (
          <p className="muted small">
            Envíos: {cert.envios.map((e) => `${e.canal === 'email' ? 'email' : 'WhatsApp'} a ${e.destino} (${fmtFechaCorta(e.fecha)})`).join(' · ')}
          </p>
        )}
      </div>
    </div>
  );
}
