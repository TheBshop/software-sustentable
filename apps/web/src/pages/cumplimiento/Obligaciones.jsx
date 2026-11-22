import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api.js';

const COLOR = { verde: '#10b981', amarillo: '#f59e0b', rojo: '#ef4444', gris: '#9ca3af' };
const ICONO = { verde: '✓', amarillo: '⚠', rojo: '✕', gris: '—' };
const LABEL = { verde: 'Al día', amarillo: 'Vence pronto', rojo: 'Vencido', gris: 'Sin cargar' };

export default function Obligaciones() {
  const [data, setData] = useState(null);
  const [filtro, setFiltro] = useState('todas');
  const nav = useNavigate();

  useEffect(() => { api('/obligaciones').then(setData); }, []);

  if (!data) return <p>Cargando obligaciones...</p>;

  const items = filtro === 'todas' ? data.items : data.items.filter((i) => i.categoria === filtro);

  const categorias = Object.entries(data.categorias);

  return (
    <div className="pant pant-ancha">
      <h1>Obligaciones fiscales y regulatorias</h1>
      <p className="ayuda-pant">Estado de cada obligación que tu organización debe cumplir. Los semáforos se calculan en base a vencimientos conocidos y datos cargados en la plataforma.</p>

      <div className="kpis" style={{ marginBottom: '1.5rem' }}>
        <Kpi color={COLOR.verde} n={data.resumen.verde} label="Al día" />
        <Kpi color={COLOR.amarillo} n={data.resumen.amarillo} label="Vence pronto" />
        <Kpi color={COLOR.rojo} n={data.resumen.rojo} label="Vencido" />
        <Kpi color={COLOR.gris} n={data.resumen.gris} label="Sin cargar" />
      </div>

      <div className="barra-filtros">
        <button className={filtro === 'todas' ? 'activo' : ''} onClick={() => setFiltro('todas')}>Todas ({data.resumen.total})</button>
        {categorias.map(([k, v]) => (
          <button key={k} className={filtro === k ? 'activo' : ''} onClick={() => setFiltro(k)}>{v} ({data.items.filter((i) => i.categoria === k).length})</button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((it) => (
          <div key={it.id} className="tarjeta" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: it.ruta ? 'pointer' : 'default', borderLeft: `4px solid ${COLOR[it.semaforo]}` }} onClick={() => it.ruta && nav(it.ruta)}>
            <span style={{ fontSize: 20, color: COLOR[it.semaforo], fontWeight: 700, minWidth: 28, textAlign: 'center' }}>{ICONO[it.semaforo]}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 14 }}>{it.titulo}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{it.norma}</div>
              {it.ayuda && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{it.ayuda}</div>}
            </div>
            <div style={{ textAlign: 'right', minWidth: 120 }}>
              <span className={`badge badge-${it.semaforo}`}>{LABEL[it.semaforo]}</span>
              {it.dias != null && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{it.dias < 0 ? `Hace ${-it.dias} días` : it.dias === 0 ? 'Hoy' : `En ${it.dias} días`}</div>}
              {it.vence && <div style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(it.vence).toLocaleDateString('es-AR')}</div>}
            </div>
            {it.automatico && <span style={{ fontSize: 10, background: '#dbeafe', color: '#1e40af', padding: '2px 6px', borderRadius: 4 }}>AUTO</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Kpi({ color, n, label }) {
  return (
    <div className="kpi" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="kpi-valor">{n}</div>
      <div className="kpi-titulo">{label}</div>
    </div>
  );
}
