import { useEffect, useState } from 'react';
import { api, isoDate } from '../api.js';
import { useLoad, ErrorMsg } from '../ui.jsx';

const PROCESOS = ['Clasificación', 'Enfardado', 'Molienda', 'Lavado', 'Extrusión', 'Compostaje'];

/** Datos que exige el certificado verde y qué le falta a la organización. */
export default function CertificadoVerdeConfig({ org, onSaved }) {
  const req = useLoad('/certificados/requisitos');
  const cv = org?.certificadoVerde ?? {};
  const inicial = () => ({
    domicilio: org?.domicilio ?? '', cuit: org?.cuit ?? '',
    inaes: cv.inaes ?? '', habilitacionMunicipal: cv.habilitacionMunicipal ?? '', caa: cv.caa ?? '', registroProvincial: cv.registroProvincial ?? '',
    basculaVence: cv.basculaVence ? isoDate(new Date(cv.basculaVence)) : '',
    propio: cv.transporte?.propio !== false, trRazon: cv.transporte?.razonSocial ?? '', trCuit: cv.transporte?.cuit ?? '', trHab: cv.transporte?.habilitacion ?? '',
    responsableTecnico: cv.responsableTecnico ?? '', matriculaTecnico: cv.matriculaTecnico ?? '', procesos: cv.procesos ?? [],
  });
  const [form, setForm] = useState(inicial);
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(null);
  useEffect(() => setForm(inicial()), [org?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const coop = !['empresa', 'planta_publica'].includes(org?.perfil);

  async function guardar(e) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    try {
      await api('/planta/organizacion/certificado-verde', {
        method: 'PATCH',
        body: {
          domicilio: form.domicilio.trim(),
          ...(form.cuit && !org?.cuit && { cuit: form.cuit }),
          inaes: form.inaes.trim(), habilitacionMunicipal: form.habilitacionMunicipal.trim(), caa: form.caa.trim(), registroProvincial: form.registroProvincial.trim(),
          basculaVence: form.basculaVence || null,
          transporte: { propio: form.propio, ...(!form.propio && { razonSocial: form.trRazon.trim(), cuit: form.trCuit.trim() }), habilitacion: form.trHab.trim() },
          responsableTecnico: form.responsableTecnico.trim(), matriculaTecnico: form.matriculaTecnico.trim(), procesos: form.procesos,
        },
      });
      setOk('Guardado. Se usa en los próximos certificados.');
      await Promise.all([req.reload(), onSaved()]);
    } catch (e2) {
      setErr(e2.message);
    }
  }

  const items = req.data?.items ?? [];
  return (
    <div className="grid2">
      <form className="card stack" onSubmit={guardar}>
        <h3>Datos del certificado verde</h3>
        <div className="form-grid">
          <label>Domicilio de la planta<input value={form.domicilio} onChange={set('domicilio')} /></label>
          <label>CUIT<input value={form.cuit} onChange={set('cuit')} disabled={Boolean(org?.cuit)} /></label>
          {coop && <label>Matrícula INAES<input value={form.inaes} onChange={set('inaes')} /></label>}
          <label>Habilitación municipal<input value={form.habilitacionMunicipal} onChange={set('habilitacionMunicipal')} /></label>
          <label>Certificado de aptitud ambiental<input value={form.caa} onChange={set('caa')} /></label>
          <label>Inscripción en el registro provincial<input value={form.registroProvincial} onChange={set('registroProvincial')} placeholder="Destinos sustentables u operadores" /></label>
          <label>La calibración de la báscula vence<input type="date" value={form.basculaVence} onChange={set('basculaVence')} /></label>
          {!coop && <label>Responsable técnico<input value={form.responsableTecnico} onChange={set('responsableTecnico')} /></label>}
          {!coop && <label>Matrícula profesional<input value={form.matriculaTecnico} onChange={set('matriculaTecnico')} /></label>}
        </div>
        <label className="check"><input type="checkbox" checked={form.propio} onChange={(e) => setForm({ ...form, propio: e.target.checked })} /> El transporte es propio</label>
        <div className="form-grid">
          {!form.propio && <label>Transportista<input value={form.trRazon} onChange={set('trRazon')} /></label>}
          {!form.propio && <label>CUIT del transportista<input value={form.trCuit} onChange={set('trCuit')} /></label>}
          <label>Habilitación del transporte<input value={form.trHab} onChange={set('trHab')} /></label>
        </div>
        <div className="tags" role="group" aria-label="Procesos de la planta">
          {PROCESOS.map((p) => (
            <label key={p} className="check"><input type="checkbox" checked={form.procesos.includes(p)} onChange={(e) => setForm({ ...form, procesos: e.target.checked ? [...form.procesos, p] : form.procesos.filter((x) => x !== p) })} /> {p}</label>
          ))}
        </div>
        <ErrorMsg error={err} />
        {ok && <p className="ok">{ok}</p>}
        <div><button type="submit">Guardar</button></div>
      </form>
      <section className="card stack">
        <div className={`veredicto ${req.data?.completo ? 'ok' : 'mal'}`}>
          <span className="small">{req.data?.documento}</span>
          <strong>{req.data?.completo ? 'Tus certificados cumplen' : 'Tus certificados todavía no valen como certificado verde'}</strong>
          <span className="small">Además, cada retiro tiene que tener el CUIT del cliente, el peso de báscula y su remito o manifiesto.</span>
        </div>
        <ul className="req">
          {items.map((i) => <li key={i.texto} className={i.ok ? 'ok' : ''}><b>{i.texto}</b><span className="small muted">{i.grupo}</span></li>)}
        </ul>
      </section>
    </div>
  );
}
