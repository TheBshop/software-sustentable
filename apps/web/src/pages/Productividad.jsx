import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getUser, fmtFecha, isoDate } from '../api.js';
import { useLoad, ErrorMsg, Tag, ConfirmButton } from '../ui.jsx';

const GRUPOS = { procesamiento: 'Procesamiento', personal: 'Personal', comercializacion: 'Comercialización' };
const MAQUINAS = { cinta: 'Cinta de clasificación', prensa: 'Prensa / enfardadora', autoelevador: 'Autoelevador', molino: 'Molino', otra: 'Otra' };
const CAUSAS = { rotura: 'Rotura', falta_material: 'Falta de material', falta_energia: 'Corte de energía', mantenimiento: 'Mantenimiento', falta_personal: 'Falta de personal', otra: 'Otra' };
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const nombreMes = (m) => { const [y, mm] = m.split('-'); return `${MESES[Number(mm) - 1]} ${y}`; };
const ultimosMeses = (n = 12) => Array.from({ length: n }, (_, i) => { const d = new Date(); d.setDate(15); d.setMonth(d.getMonth() - i); return isoDate(d).slice(0, 7); });
const n = (v, d = 2) => Number(v).toLocaleString('es-AR', { maximumFractionDigits: d });

function valor(i) {
  if (i.valor == null) return null;
  if (i.unidad === '%') return `${n(i.valor, 1)} %`;
  if (i.unidad === '$/kg') return `$ ${n(i.valor)} por kg`;
  return `${n(i.valor)} ${i.unidad}`;
}

/** Indicadores de la guía de productividad para plantas de clasificación. */
export default function Productividad() {
  const [mes, setMes] = useState(ultimosMeses()[0]);
  const { data, error, reload } = useLoad(`/productividad?mes=${mes}`);
  const rol = getUser()?.rol;
  const puedeCargarPersonal = ['admin', 'administracion'].includes(rol);
  const d = data?.datos;
  const maxIp = Math.max(0.01, ...(data?.evolucion ?? []).map((e) => e.indiceProductividad ?? 0));

  return (
    <>
      <div className="view-head">
        <div>
          <h2>Productividad de la planta</h2>
          <p className="muted">Que crezca lo que cobra cada trabajador por la venta del material. Compará cada indicador mes a mes.</p>
        </div>
        <select aria-label="Mes" value={mes} onChange={(e) => setMes(e.target.value)}>
          {ultimosMeses().map((m) => <option key={m} value={m}>{nombreMes(m)}</option>)}
        </select>
      </div>
      <ErrorMsg error={error} />

      {data && (
        <>
          <div className="grid2">
            <section className="card ip-card">
              <span>Índice de productividad · {nombreMes(mes)}</span>
              <strong>{data.indiceProductividad == null ? '—' : `${n(data.indiceProductividad)} t`}</strong>
              <span className="small">toneladas vendidas por persona en el mes{data.indiceProductividad == null && ' · falta cargar el personal del mes'}</span>
            </section>
            <section className="card">
              <h3>Últimos 6 meses</h3>
              <div className="columnas" style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', height: 130 }} role="img" aria-label="Índice de productividad de los últimos 6 meses">
                {data.evolucion.map((e) => (
                  <div key={e.mes} className="columna" title={`${nombreMes(e.mes)}: ${e.indiceProductividad == null ? 'sin datos' : `${n(e.indiceProductividad)} t por persona`}`}>
                    <span className="columna-valor">{e.indiceProductividad == null ? '—' : n(e.indiceProductividad, 1)}</span>
                    <span className="columna-barra" style={{ height: `${((e.indiceProductividad ?? 0) / maxIp) * 100}%`, opacity: e.mes === mes ? 1 : 0.55 }} />
                    <span className="columna-label">{nombreMes(e.mes).split(' ')[0]}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="kpis">
            <div className="kpi"><span>Ingresado</span><strong>{n(d.ingresadoTn)} t</strong></div>
            <div className="kpi"><span>Separado y acopiado</span><strong>{n(d.separadoTn)} t</strong></div>
            <div className="kpi"><span>Rechazo a disposición final</span><strong>{n(d.rechazoTn)} t</strong></div>
            <div className="kpi green"><span>Vendido</span><strong>{n(d.vendidoTn)} t</strong></div>
          </div>

          <div className="prod-grupos">
            {Object.entries(GRUPOS).map(([g, titulo]) => (
              <section key={g} className="card flush">
                <div className="card-head"><h3>{titulo}</h3></div>
                <table>
                  <tbody>
                    {data.indicadores.filter((i) => i.grupo === g).map((i) => (
                      <tr key={i.clave}>
                        <td>
                          <b>{i.nombre}</b>
                          <div className="muted small">{i.formula}</div>
                        </td>
                        <td className="r">
                          {i.valor == null ? <span className="muted small">{i.falta}</span> : <span className="num ind-valor">{valor(i)}</span>}
                          <div>{i.fuente === 'automatico' ? <Tag tone="green">Automático</Tag> : <Tag>Se carga</Tag>}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
          <p className="muted small">
            "Automático" sale de los ingresos, la clasificación, los rechazos y las ventas que ya registra la planta. "Se carga" necesita los datos de abajo. Los accidentes se registran en <Link to="/seguridad">Seguridad e higiene</Link>.
          </p>

          <div className="grid2">
            {puedeCargarPersonal ? <FormPersonal mes={mes} personal={data.personal} onSaved={reload} /> : null}
            <Paradas mes={mes} onChange={reload} />
          </div>
          {rol === 'admin' && <FormPlanta planta={data.planta} onSaved={reload} />}
        </>
      )}
    </>
  );
}

const CAMPOS_PERSONAL = [
  ['personas', 'Personas que trabajan en la planta', 'Incluye ausentes, accidentados y de vacaciones'],
  ['formalizadas', 'Personas formalizadas', 'Monotributo social o común, o en relación de dependencia'],
  ['diasTrabajados', 'Días trabajados (todas las personas)', null],
  ['diasAusencia', 'Días perdidos por ausentismo', 'De personas con más de 3 meses de antigüedad'],
  ['bajas', 'Personas que se fueron en el mes', null],
  ['ingresoPromedio', 'Ingreso promedio por persona ($)', 'Todo lo que cobra: retiros, reparto de ventas, subsidios'],
  ['smvm', 'Salario mínimo, vital y móvil del mes ($)', null],
];

function FormPersonal({ mes, personal, onSaved }) {
  const vacio = () => Object.fromEntries(CAMPOS_PERSONAL.map(([k]) => [k, personal?.[k] ?? '']));
  const [form, setForm] = useState(vacio);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => { setForm(vacio()); setMsg(null); }, [mes, personal?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function guardar(e) {
    e.preventDefault();
    setErr(null);
    const body = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== '').map(([k, v]) => [k, Number(v)]));
    if (body.personas == null) return setErr('Indicá cuántas personas trabajaron en el mes.');
    try {
      await api(`/productividad/personal/${mes}`, { method: 'PUT', body });
      setMsg('Personal del mes guardado.');
      await onSaved();
    } catch (e2) {
      setErr(e2.message);
    }
  }

  return (
    <form className="card stack" onSubmit={guardar}>
      <h3>Personal de {nombreMes(mes)}</h3>
      <div className="form-grid">
        {CAMPOS_PERSONAL.map(([k, label, ayuda]) => (
          <label key={k} title={ayuda ?? undefined}>
            {label}
            <input type="number" min="0" step="any" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
          </label>
        ))}
      </div>
      <ErrorMsg error={err} />
      {msg && <p className="ok">{msg}</p>}
      <div><button type="submit">Guardar personal del mes</button></div>
    </form>
  );
}

function Paradas({ mes, onChange }) {
  const { data, reload } = useLoad(`/productividad/paradas?mes=${mes}`);
  const [form, setForm] = useState({ fecha: isoDate(), maquina: 'cinta', horas: '', causa: 'rotura', detalle: '' });
  const [err, setErr] = useState(null);
  const recargar = () => Promise.all([reload(), onChange()]);

  async function agregar(e) {
    e.preventDefault();
    setErr(null);
    if (!(Number(form.horas) > 0)) return setErr('Indicá cuántas horas estuvo parada.');
    try {
      await api('/productividad/paradas', { method: 'POST', body: { ...form, horas: Number(form.horas), detalle: form.detalle.trim() || undefined } });
      setForm({ ...form, horas: '', detalle: '' });
      await recargar();
    } catch (e2) {
      setErr(e2.message);
    }
  }

  return (
    <section className="card stack">
      <h3>Paradas de máquina</h3>
      <p className="muted small">Registrá las paradas largas (más de medio turno). Las de la cinta entran en el indicador.</p>
      <form className="form-grid" onSubmit={agregar}>
        <label>Fecha<input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></label>
        <label>Máquina<select value={form.maquina} onChange={(e) => setForm({ ...form, maquina: e.target.value })}>{Object.entries(MAQUINAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>Horas<input type="number" min="0" step="any" value={form.horas} onChange={(e) => setForm({ ...form, horas: e.target.value })} /></label>
        <label>Causa<select value={form.causa} onChange={(e) => setForm({ ...form, causa: e.target.value })}>{Object.entries(CAUSAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>Detalle<input value={form.detalle} onChange={(e) => setForm({ ...form, detalle: e.target.value })} placeholder="Opcional" /></label>
        <div style={{ alignSelf: 'end' }}><button type="submit">Registrar parada</button></div>
      </form>
      <ErrorMsg error={err} />
      <ul className="lista-simple">
        {data?.items.map((p) => (
          <li key={p._id}>
            <span>{fmtFecha(p.fecha)} · {MAQUINAS[p.maquina]} · <b className="num">{n(p.horas, 1)} h</b> · {CAUSAS[p.causa]}{p.detalle && ` · ${p.detalle}`}</span>
            <ConfirmButton onConfirm={() => api(`/productividad/paradas/${p._id}`, { method: 'DELETE' }).then(recargar)} confirmLabel="Sí, borrar">Borrar</ConfirmButton>
          </li>
        ))}
        {data && !data.items.length && <li className="muted small">No hay paradas registradas en el mes.</li>}
      </ul>
    </section>
  );
}

function FormPlanta({ planta, onSaved }) {
  const [form, setForm] = useState({ capacidadTnMes: planta?.capacidadTnMes ?? '', horasTrabajablesMes: planta?.horasTrabajablesMes ?? '' });
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);
  async function guardar(e) {
    e.preventDefault();
    setErr(null);
    try {
      const body = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== '').map(([k, v]) => [k, Number(v)]));
      await api('/productividad/planta', { method: 'PATCH', body });
      setMsg('Datos de la planta guardados.');
      await onSaved();
    } catch (e2) {
      setErr(e2.message);
    }
  }
  return (
    <form className="card stack" onSubmit={guardar}>
      <h3>Datos de la planta</h3>
      <p className="muted small">Se cargan una vez. La capacidad instalada sale de las instalaciones (cinta, prensas); las horas trabajables, de los turnos.</p>
      <div className="form-grid">
        <label>Capacidad instalada (t por mes)<input type="number" min="0" step="any" value={form.capacidadTnMes} onChange={(e) => setForm({ ...form, capacidadTnMes: e.target.value })} /></label>
        <label>Horas trabajables por mes<input type="number" min="0" step="any" value={form.horasTrabajablesMes} onChange={(e) => setForm({ ...form, horasTrabajablesMes: e.target.value })} /></label>
      </div>
      <ErrorMsg error={err} />
      {msg && <p className="ok">{msg}</p>}
      <div><button type="submit">Guardar</button></div>
    </form>
  );
}
