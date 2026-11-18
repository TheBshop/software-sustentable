// Proceso de planta: mapa de etapas, lotes (recepción → clasificado → enfardado → vendido),
// venta de lotes con remito y especificaciones de calidad por comprador.
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, fmtFecha, fmtKg, getUser, openPdf } from '../../api.js';
import { useLoad, ErrorMsg, ConfirmButton } from '../../ui.jsx';
import Ayuda from '../../shell/Ayuda.jsx';

const ETAPAS = { recepcion: 'Recepción', clasificado: 'Clasificado', enfardado: 'Listo para vender', vendido: 'Vendido', derivado: 'Clasificado en lotes' };
const ACCION = { recepcion: 'Clasificar', clasificado: 'Enfardar' };
const CAUSAS = { humedad: 'Humedad', mezclado: 'Mezclado', contaminado: 'Contaminado', no_reciclable: 'No reciclable', otro: 'Otro' };
const CONTROL_TONO = { Apto: 'green', 'Sin controlar': 'gray' };
const num = (v) => (v === '' || v == null ? undefined : Number(v));

function Mapa({ data }) {
  return (
    <div className="stack">
      <div className="mapa">
        {data.etapas.map((e, i) => (
          <Link key={e.id} to={e.link} className="kpi kpi-link mapa-etapa">
            <span>{i + 1}. {e.label}</span>
            <strong>{e.lotes != null ? `${e.lotes} ${e.lotes === 1 ? 'lote' : 'lotes'}` : e.cantidad}</strong>
            {e.kg != null && <span className="small">{fmtKg(e.kg)}</span>}
          </Link>
        ))}
      </div>
      {data.avisos.length > 0 && (
        <div className="avisos">
          {data.avisos.map((a) => (
            <Link key={a.texto} to={a.link} className={`aviso ${a.tono}`}><span>{a.texto}</span><span aria-hidden="true">→</span></Link>
          ))}
        </div>
      )}
    </div>
  );
}

function FormLote({ lote, materiales, onListo, onCancelar }) {
  const [f, setF] = useState({ control: 'Apto', humedad: '', kgSeparado: '', kgRechazo: '', causaRechazo: 'humedad', unidades: '', kgFinal: lote.kg, items: [{ material: '', kg: '' }] });
  const [error, setError] = useState(null);
  const mezcla = lote.material.mezcla;
  const set = (k, v) => setF({ ...f, [k]: v });

  async function enviar(e) {
    e.preventDefault();
    setError(null);
    try {
      if (lote.etapa === 'recepcion') {
        const items = mezcla ? f.items.filter((i) => i.material && Number(i.kg) > 0).map((i) => ({ material: i.material, kg: Number(i.kg) })) : undefined;
        await api(`/lotes/${lote._id}/clasificar`, {
          method: 'POST',
          body: { control: f.control, humedad: num(f.humedad), kgSeparado: mezcla ? undefined : num(f.kgSeparado), kgRechazo: num(f.kgRechazo), causaRechazo: num(f.kgRechazo) ? f.causaRechazo : undefined, items },
        });
      } else {
        await api(`/lotes/${lote._id}/enfardar`, { method: 'POST', body: { unidades: num(f.unidades), kgFinal: Number(f.kgFinal) } });
      }
      onListo();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="card stack" onSubmit={enviar}>
      <div className="page-h">
        <h3>{lote.codigo} · {ACCION[lote.etapa]}</h3>
        <span className="small muted">{lote.material.nombre} · {fmtKg(lote.kg)}{lote.origen?.cliente ? ` de ${lote.origen.cliente.razonSocial}` : ''}</span>
      </div>
      {lote.etapa === 'recepcion' ? (
        <>
          <div className="form-grid">
            <label>
              Control al recibir
              <select value={f.control} onChange={(e) => set('control', e.target.value)}>
                {['Apto', 'Húmedo', 'Mezclado', 'Contaminado'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label>Humedad estimada (%)<input type="number" min="0" max="100" step="any" value={f.humedad} onChange={(e) => set('humedad', e.target.value)} /></label>
            {!mezcla && <label>Kg separados para vender<input type="number" min="0" step="any" required value={f.kgSeparado} onChange={(e) => set('kgSeparado', e.target.value)} /></label>}
            <label>Kg de rechazo<input type="number" min="0" step="any" value={f.kgRechazo} onChange={(e) => set('kgRechazo', e.target.value)} /></label>
            <label>
              Causa del rechazo
              <select value={f.causaRechazo} onChange={(e) => set('causaRechazo', e.target.value)}>
                {Object.entries(CAUSAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </div>
          {mezcla && (
            <div className="stack">
              <p className="small muted">Material mezclado: indicá cuánto salió de cada material. Cada uno abre su propio lote.</p>
              {f.items.map((it, i) => (
                <div key={i} className="item-row">
                  <select aria-label="Material" value={it.material} onChange={(e) => set('items', f.items.map((x, j) => (j === i ? { ...x, material: e.target.value } : x)))}>
                    <option value="">Material…</option>
                    {materiales.filter((m) => !m.mezcla).map((m) => <option key={m._id} value={m._id}>{m.nombre}</option>)}
                  </select>
                  <input aria-label="Kg" type="number" min="0" step="any" placeholder="kg" value={it.kg} onChange={(e) => set('items', f.items.map((x, j) => (j === i ? { ...x, kg: e.target.value } : x)))} />
                  <button type="button" className="link danger" aria-label="Quitar" disabled={f.items.length === 1} onClick={() => set('items', f.items.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
              <button type="button" className="link" onClick={() => set('items', [...f.items, { material: '', kg: '' }])}>+ Agregar material</button>
            </div>
          )}
        </>
      ) : (
        <div className="form-grid">
          <label>Fardos o bolsones<input type="number" min="0" step="1" value={f.unidades} onChange={(e) => set('unidades', e.target.value)} /></label>
          <label>
            <span>Kg resultantes<Ayuda>Si es menos que lo separado, la diferencia se registra como merma (pérdida de humedad, recortes).</Ayuda></span>
            <input type="number" min="0" step="any" required value={f.kgFinal} onChange={(e) => set('kgFinal', e.target.value)} />
          </label>
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row">
        <button type="submit">Guardar</button>
        <button type="button" className="secondary" onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  );
}

function Vender({ lotes, compradores, onListo }) {
  const [f, setF] = useState({ comprador: '', pesaje: 'Báscula', patente: '', precios: {}, kgs: {} });
  const [error, setError] = useState(null);
  const total = lotes.reduce((a, l) => a + Number(f.kgs[l._id] ?? l.kg) * Number(f.precios[l._id] ?? 0), 0);

  async function enviar(e) {
    e.preventDefault();
    setError(null);
    try {
      const r = await api('/lotes/vender', {
        method: 'POST',
        body: {
          comprador: f.comprador,
          pesaje: f.pesaje,
          ...(f.patente && { transporte: { patente: f.patente } }),
          items: lotes.map((l) => ({ lote: l._id, kg: Number(f.kgs[l._id] ?? l.kg), precioKg: Number(f.precios[l._id]) })),
        },
      });
      onListo(r.remito);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="card stack" onSubmit={enviar}>
      <h3>Vender {lotes.length === 1 ? 'el lote' : `${lotes.length} lotes`}</h3>
      <div className="form-grid">
        <label>
          Comprador
          <select value={f.comprador} required onChange={(e) => setF({ ...f, comprador: e.target.value })}>
            <option value="">Elegí…</option>
            {compradores.map((c) => <option key={c._id} value={c._id}>{c.razonSocial}</option>)}
          </select>
        </label>
        <label>
          Pesaje
          <select value={f.pesaje} onChange={(e) => setF({ ...f, pesaje: e.target.value })}>
            <option>Báscula</option>
            <option>Estimado</option>
          </select>
        </label>
        <label>Patente del camión<input type="text" value={f.patente} onChange={(e) => setF({ ...f, patente: e.target.value })} /></label>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Lote</th><th>Material</th><th className="r">Kg</th><th className="r">$ por kg</th></tr></thead>
          <tbody>
            {lotes.map((l) => (
              <tr key={l._id}>
                <td className="mono">{l.codigo}</td>
                <td>{l.material.nombre}</td>
                <td className="r"><input aria-label={`Kg de ${l.codigo}`} type="number" min="0" step="any" style={{ maxWidth: 110 }} value={f.kgs[l._id] ?? l.kg} onChange={(e) => setF({ ...f, kgs: { ...f.kgs, [l._id]: e.target.value } })} /></td>
                <td className="r"><input aria-label={`Precio de ${l.codigo}`} type="number" min="0" step="any" required style={{ maxWidth: 110 }} value={f.precios[l._id] ?? ''} onChange={(e) => setF({ ...f, precios: { ...f.precios, [l._id]: e.target.value } })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="total-line"><span>Total</span><span className="num">$ {total.toLocaleString('es-AR', { maximumFractionDigits: 2 })}</span></div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row">
        <button type="submit">Registrar venta y emitir remito</button>
      </div>
    </form>
  );
}

function Calidad({ materiales, compradores }) {
  const { data, reload } = useLoad('/calidad');
  const [f, setF] = useState({ material: '', comprador: '', humedadMax: '', impurezasMax: '', presentacion: '' });
  const [error, setError] = useState(null);
  const puede = ['admin', 'administracion', 'operador_planta'].includes(getUser()?.rol);
  async function agregar(e) {
    e.preventDefault();
    setError(null);
    try {
      await api('/calidad', { method: 'POST', body: { material: f.material, comprador: f.comprador || undefined, humedadMax: num(f.humedadMax), impurezasMax: num(f.impurezasMax), presentacion: f.presentacion || undefined } });
      setF({ material: '', comprador: '', humedadMax: '', impurezasMax: '', presentacion: '' });
      reload();
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <section className="card stack">
      <h3>Calidad que pide cada comprador<Ayuda>Humedad e impurezas máximas y presentación (fardo, bolsón, molido). Sirven para controlar cada lote antes de vender.</Ayuda></h3>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Material</th><th>Comprador</th><th className="r">Humedad máx.</th><th className="r">Impurezas máx.</th><th>Presentación</th>{puede && <th />}</tr></thead>
          <tbody>
            {data?.items.map((s) => (
              <tr key={s._id}>
                <td>{s.material?.nombre}</td>
                <td>{s.comprador?.razonSocial ?? 'Todos'}</td>
                <td className="r num">{s.humedadMax != null ? `${s.humedadMax} %` : '—'}</td>
                <td className="r num">{s.impurezasMax != null ? `${s.impurezasMax} %` : '—'}</td>
                <td>{s.presentacion ?? '—'}</td>
                {puede && <td><ConfirmButton onConfirm={() => api(`/calidad/${s._id}`, { method: 'DELETE' }).then(reload)}>Quitar</ConfirmButton></td>}
              </tr>
            ))}
            {data && !data.items.length && <tr><td colSpan={6} className="muted">Todavía no cargaste especificaciones.</td></tr>}
          </tbody>
        </table>
      </div>
      {puede && (
        <form className="form-grid" onSubmit={agregar}>
          <label>
            Material
            <select required value={f.material} onChange={(e) => setF({ ...f, material: e.target.value })}>
              <option value="">Elegí…</option>
              {materiales.filter((m) => !m.mezcla).map((m) => <option key={m._id} value={m._id}>{m.nombre}</option>)}
            </select>
          </label>
          <label>
            Comprador
            <select value={f.comprador} onChange={(e) => setF({ ...f, comprador: e.target.value })}>
              <option value="">Todos</option>
              {compradores.map((c) => <option key={c._id} value={c._id}>{c.razonSocial}</option>)}
            </select>
          </label>
          <label>Humedad máx. (%)<input type="number" min="0" max="100" step="any" value={f.humedadMax} onChange={(e) => setF({ ...f, humedadMax: e.target.value })} /></label>
          <label>Impurezas máx. (%)<input type="number" min="0" max="100" step="any" value={f.impurezasMax} onChange={(e) => setF({ ...f, impurezasMax: e.target.value })} /></label>
          <label>Presentación<input type="text" placeholder="Fardo de 250 kg" value={f.presentacion} onChange={(e) => setF({ ...f, presentacion: e.target.value })} /></label>
          <div className="row" style={{ alignSelf: 'end' }}><button type="submit" className="secondary">Agregar</button></div>
          {error && <p className="error" role="alert">{error}</p>}
        </form>
      )}
    </section>
  );
}

export default function Proceso() {
  const [params, setParams] = useSearchParams();
  const etapa = params.get('etapa') ?? '';
  const mapa = useLoad('/proceso');
  const lotes = useLoad(etapa ? `/lotes?etapa=${etapa}` : '/lotes');
  const mats = useLoad('/materiales?limit=200');
  const clientes = useLoad('/clientes?limit=200');
  const [activo, setActivo] = useState(null);
  const [aVender, setAVender] = useState([]);
  const [remito, setRemito] = useState(null);
  const rol = getUser()?.rol;
  const gestiona = ['admin', 'administracion', 'operador_planta'].includes(rol);
  const vende = ['admin', 'administracion'].includes(rol);
  const compradores = useMemo(() => (clientes.data?.items ?? []).filter((c) => c.tipo !== 'generador'), [clientes.data]);
  const materiales = mats.data?.items ?? [];

  const recargar = () => {
    setActivo(null);
    setAVender([]);
    lotes.reload();
    mapa.reload();
  };

  return (
    <div className="stack">
      <div className="page-h">
        <div>
          <h2>Proceso<Ayuda>Cada ingreso abre un lote por material. Cada paso (clasificar, enfardar, vender) carga en el libro de la planta el rechazo, la merma y la venta, así el stock y los indicadores quedan al día.</Ayuda></h2>
          <p className="muted">Del pedido de retiro a la venta, con el estado de cada lote.</p>
        </div>
      </div>
      <ErrorMsg error={mapa.error || lotes.error} />
      {mapa.data && <Mapa data={mapa.data} />}
      {remito && (
        <div className="aviso info">
          <span>Venta registrada. Remito {remito.codigo} emitido.</span>
          <button type="button" className="secondary sm" onClick={() => openPdf(`/remitos/${remito.id}/pdf`)}>Ver remito</button>
        </div>
      )}
      {activo && <FormLote key={activo._id} lote={activo} materiales={materiales} onListo={recargar} onCancelar={() => setActivo(null)} />}
      {aVender.length > 0 && <Vender key={aVender.map((l) => l._id).join()} lotes={aVender} compradores={compradores} onListo={(r) => { setRemito(r); recargar(); }} />}
      <section className="card flush">
        <div className="card-head">
          <h3>Lotes</h3>
          <label className="row small">
            Ver
            <select value={etapa} onChange={(e) => setParams(e.target.value ? { etapa: e.target.value } : {})} style={{ width: 'auto' }}>
              <option value="">Abiertos</option>
              {Object.entries(ETAPAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {vende && <th aria-label="Elegir para vender" />}
                <th>Lote</th><th>Fecha</th><th>Origen</th><th>Material</th><th className="r">Kg</th><th>Control</th><th className="r">Rechazo</th><th>Etapa</th>{gestiona && <th />}
              </tr>
            </thead>
            <tbody>
              {lotes.data?.items.map((l) => (
                <tr key={l._id}>
                  {vende && (
                    <td>
                      {l.etapa === 'enfardado' && (
                        <input type="checkbox" aria-label={`Vender ${l.codigo}`} style={{ width: 'auto' }} checked={aVender.some((x) => x._id === l._id)} onChange={(e) => setAVender(e.target.checked ? [...aVender, l] : aVender.filter((x) => x._id !== l._id))} />
                      )}
                    </td>
                  )}
                  <td className="mono">{l.codigo}</td>
                  <td>{fmtFecha(l.fecha)}</td>
                  <td>{l.origen?.cliente?.razonSocial ?? { retiro: 'Retiro', recoleccion_municipal: 'Recolección municipal', recuperador: 'Recuperador', entrega_voluntaria: 'Entrega voluntaria', clasificacion: 'Clasificación', otro: 'Otro' }[l.origen?.tipo] ?? '—'}</td>
                  <td>{l.material.nombre}</td>
                  <td className="r num">{fmtKg(l.kg)}{l.estimado && <span className="small muted"> est.</span>}</td>
                  <td><span className={`tag ${CONTROL_TONO[l.control] ?? 'sun'}`}>{l.control}</span></td>
                  <td className={`r num ${l.pctRechazo > 30 ? 'error' : ''}`}>{l.pctRechazo == null ? '—' : `${l.pctRechazo.toLocaleString('es-AR')} %`}</td>
                  <td><span className="tag gray">{ETAPAS[l.etapa]}</span>{l.remito && <span className="small muted"> R-{String(l.remito.numero).padStart(6, '0')}</span>}</td>
                  {gestiona && <td>{ACCION[l.etapa] && <button type="button" className="secondary sm" onClick={() => setActivo(l)}>{ACCION[l.etapa]}</button>}</td>}
                </tr>
              ))}
              {lotes.data && !lotes.data.items.length && <tr><td colSpan={10} className="muted">No hay lotes {etapa ? `en "${ETAPAS[etapa]}"` : 'abiertos'}. Cada ingreso de material abre uno.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <Calidad materiales={materiales} compradores={compradores} />
    </div>
  );
}
