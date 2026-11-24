// Facturación electrónica AFIP. En modo mock por defecto; cuando la organización
// cargue su certificado, pasa a emitir contra AFIP real.
import { useEffect, useState } from 'react';
import { api, fmtFecha, fmtPeso, getUser, openPdf } from '../../api.js';
import { useLoad, ErrorMsg } from '../../ui.jsx';
import Ayuda from '../../shell/Ayuda.jsx';

const INICIAL = {
  tipo: 11,
  receptorNombre: '',
  docTipo: 99,
  docNro: '',
  condIvaReceptor: 5,
  importeNeto: '',
  importeIva: '',
  importeTotal: '',
};

function Emitir({ catalogos, onEmitido }) {
  const [f, setF] = useState(INICIAL);
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(null);
  const admin = ['admin', 'administracion'].includes(getUser()?.rol);
  if (!admin) return null;

  async function enviar(e) {
    e.preventDefault();
    setErr(null); setOk(null);
    try {
      const body = {
        tipo: Number(f.tipo),
        receptorNombre: f.receptorNombre || undefined,
        docTipo: Number(f.docTipo),
        docNro: f.docNro || '0',
        condIvaReceptor: Number(f.condIvaReceptor),
        importeNeto: Number(f.importeNeto),
        importeIva: f.importeIva ? Number(f.importeIva) : 0,
        importeTotal: Number(f.importeTotal),
      };
      const c = await api('/afip/comprobantes', { method: 'POST', body });
      setOk(c);
      setF(INICIAL);
      onEmitido();
    } catch (x) { setErr(x.message); }
  }

  return (
    <form className="card stack" onSubmit={enviar}>
      <h3>Emitir comprobante<Ayuda>En modo prueba: devuelve un CAE simulado sin validez fiscal. Cuando la organización cargue su certificado ARCA real, pasa automáticamente a emitir comprobantes válidos.</Ayuda></h3>
      <div className="form-grid">
        <label>Tipo<select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
          {catalogos && Object.entries(catalogos.tipos).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select></label>
        <label>Receptor<input type="text" required value={f.receptorNombre} onChange={(e) => setF({ ...f, receptorNombre: e.target.value })} /></label>
        <label>Tipo doc<select value={f.docTipo} onChange={(e) => setF({ ...f, docTipo: e.target.value })}>
          {catalogos && Object.entries(catalogos.docTipos).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select></label>
        <label>Nº doc<input type="text" value={f.docNro} onChange={(e) => setF({ ...f, docNro: e.target.value })} /></label>
        <label>Cond. IVA receptor<select value={f.condIvaReceptor} onChange={(e) => setF({ ...f, condIvaReceptor: e.target.value })}>
          {catalogos && Object.entries(catalogos.condIvaReceptor).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select></label>
        <label>Neto gravado<input type="number" step="any" min="0" required value={f.importeNeto} onChange={(e) => setF({ ...f, importeNeto: e.target.value })} /></label>
        <label>IVA<input type="number" step="any" min="0" value={f.importeIva} onChange={(e) => setF({ ...f, importeIva: e.target.value })} /></label>
        <label>Total<input type="number" step="any" min="0" required value={f.importeTotal} onChange={(e) => setF({ ...f, importeTotal: e.target.value })} /></label>
      </div>
      {err && <p className="error" role="alert">{err}</p>}
      {ok && (
        <div className="aviso info">
          <span>Comprobante <b>{ok.codigo}</b> emitido. CAE: <code>{ok.cae}</code>, vence {fmtFecha(ok.caeVence)}.</span>
          <button type="button" className="secondary sm" onClick={() => openPdf(`/afip/comprobantes/${ok._id}/pdf`)}>Ver PDF</button>
        </div>
      )}
      <div className="row"><button type="submit">Emitir</button></div>
    </form>
  );
}

export default function Afip() {
  const [tick, setTick] = useState(0);
  const [cat, setCat] = useState(null);
  const estado = useLoad('/afip/estado');
  const { data, error, reload } = useLoad(`/afip/comprobantes?_=${tick}`);
  useEffect(() => { api('/afip/catalogos').then(setCat).catch(() => {}); }, []);
  const refrescar = () => { setTick((t) => t + 1); reload(); };

  return (
    <div className="stack">
      <div className="page-h">
        <div>
          <h2>Facturación electrónica ARCA<Ayuda>Factura A, B, C o E con CAE. Se integra con el WSFE de ARCA vía homologación o producción según el certificado cargado.</Ayuda></h2>
          <p className="muted">{estado.data?.modo === 'mock' ? 'Modo prueba (mock) activo. Los comprobantes son simulados sin validez fiscal.' : 'Conectado a ARCA.'}</p>
        </div>
      </div>
      <ErrorMsg error={error} />
      <Emitir catalogos={cat} onEmitido={refrescar} />
      <div className="card flush table-wrap">
        <table>
          <thead><tr><th>Nº</th><th>Fecha</th><th>Tipo</th><th>Receptor</th><th>CAE</th><th className="r">Total</th><th /></tr></thead>
          <tbody>
            {data?.items.map((c) => (
              <tr key={c._id}>
                <td className="mono">{c.codigo}</td>
                <td>{fmtFecha(c.fecha)}</td>
                <td>{cat?.tipos[c.tipo] ?? c.tipo}</td>
                <td>{c.receptorNombre ?? '—'}</td>
                <td className="small mono">{c.cae ?? '—'}{c.modo === 'mock' && <span className="tag sun" style={{ marginLeft: 6 }}>simulado</span>}</td>
                <td className="r num">{fmtPeso(c.importeTotal)}</td>
                <td><button type="button" className="secondary sm" onClick={() => openPdf(`/afip/comprobantes/${c._id}/pdf`)}>PDF</button></td>
              </tr>
            ))}
            {data && !data.items.length && <tr><td colSpan={7} className="muted">Todavía no emitiste ningún comprobante.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
