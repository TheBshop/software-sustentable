import { useState } from 'react';
import { Link } from 'react-router-dom';

const SECCIONES = [
  { id: 'org', label: 'Organización' },
  { id: 'energia', label: 'Energía' },
  { id: 'vehiculos', label: 'Vehículos' },
  { id: 'residuos', label: 'Residuos' },
  { id: 'resultado', label: 'Resultado' },
];

const PREGUNTAS = [
  {
    seccion: 'org',
    campo: 'sector',
    label: '¿A qué sector pertenece tu organización?',
    opciones: [
      'Cooperativa de reciclado',
      'Empresa recicladora',
      'Municipio / ente público',
      'Industria y manufactura',
      'Comercio y distribución',
      'Servicios',
      'Construcción',
      'Agricultura y minería',
      'Salud',
      'Educación',
      'Otro',
    ],
  },
  {
    seccion: 'org',
    campo: 'personas',
    label: '¿Cuántas personas trabajan en tu organización?',
    opciones: ['1 persona', '2–10', '11–50', '51–250', '251–1000', 'Más de 1000'],
  },
  {
    seccion: 'energia',
    campo: 'superficie',
    label: '¿Cuál es la superficie de tus instalaciones? (m²)',
    opciones: [
      'Pequeña · hasta 300 m²',
      'Mediana · 300–2.000 m²',
      'Grande · 2.000–10.000 m²',
      'Muy grande · más de 10.000 m²',
    ],
  },
  {
    seccion: 'energia',
    campo: 'calefaccion',
    label: '¿Cuál es tu fuente principal de energía?',
    opciones: ['Electricidad de red', 'Gas natural', 'GLP / garrafa', 'Energía renovable propia', 'Otra'],
  },
  {
    seccion: 'vehiculos',
    campo: 'flota',
    label: '¿Cuántos vehículos tiene la flota?',
    opciones: ['No tengo vehículos', '1–5', '6–20', '21–100', 'Más de 100', 'No lo sé'],
  },
  {
    seccion: 'vehiculos',
    campo: 'km',
    label: '¿Cuántos kilómetros recorre cada vehículo por año, en promedio?',
    opciones: [
      'No aplica',
      'Menos de 5.000 km/año',
      '5.000–15.000 km/año',
      '15.000–30.000 km/año',
      'Más de 30.000 km/año',
    ],
  },
  {
    seccion: 'residuos',
    campo: 'residuos_kg',
    label: '¿Cuántos kg de residuos genera tu organización por mes?',
    opciones: [
      'Muy pocos · menos de 100 kg',
      'Pocos · 100–500 kg',
      'Moderado · 500–2.000 kg',
      'Mucho · 2.000–10.000 kg',
      'Grandes volúmenes · más de 10.000 kg',
      'No lo sé',
    ],
  },
  {
    seccion: 'residuos',
    campo: 'reciclaje',
    label: '¿Qué porcentaje de tus residuos se recicla o valoriza?',
    opciones: ['Nada · 0%', 'Algo · 1–25%', 'Parcial · 25–50%', 'Mayoría · 50–75%', 'Casi todo · 75–100%', 'No lo sé'],
  },
];

// Factores simplificados (tCO₂e/año estimadas)
const FACTORES = {
  personas: { '1 persona': 0.5, '2–10': 3, '11–50': 18, '51–250': 90, '251–1000': 400, 'Más de 1000': 1200 },
  superficie: { 'Pequeña · hasta 300 m²': 4, 'Mediana · 300–2.000 m²': 18, 'Grande · 2.000–10.000 m²': 70, 'Muy grande · más de 10.000 m²': 200 },
  calefaccion: { 'Electricidad de red': 1, 'Gas natural': 1.4, 'GLP / garrafa': 1.6, 'Energía renovable propia': 0.2, 'Otra': 1.2 },
  flota: { 'No tengo vehículos': 0, '1–5': 8, '6–20': 35, '21–100': 150, 'Más de 100': 600, 'No lo sé': 35 },
  km: { 'No aplica': 1, 'Menos de 5.000 km/año': 0.6, '5.000–15.000 km/año': 1, '15.000–30.000 km/año': 1.8, 'Más de 30.000 km/año': 3 },
  residuos_kg: { 'Muy pocos · menos de 100 kg': 0.5, 'Pocos · 100–500 kg': 2, 'Moderado · 500–2.000 kg': 8, 'Mucho · 2.000–10.000 kg': 30, 'Grandes volúmenes · más de 10.000 kg': 100, 'No lo sé': 8 },
  reciclaje: { 'Nada · 0%': 1, 'Algo · 1–25%': 0.85, 'Parcial · 25–50%': 0.65, 'Mayoría · 50–75%': 0.4, 'Casi todo · 75–100%': 0.15, 'No lo sé': 0.7 },
};

function calcular(r) {
  const base = (FACTORES.personas[r.personas] ?? 0) + (FACTORES.superficie[r.superficie] ?? 0);
  const energia = base * (FACTORES.calefaccion[r.calefaccion] ?? 1);
  const vehiculos = (FACTORES.flota[r.flota] ?? 0) * (FACTORES.km[r.km] ?? 1);
  const residuos = (FACTORES.residuos_kg[r.residuos_kg] ?? 0) * (FACTORES.reciclaje[r.reciclaje] ?? 1);
  return { total: energia + vehiculos + residuos, energia, vehiculos, residuos };
}

export default function CalculadoraCarbono() {
  const [paso, setPaso] = useState(0);
  const [resp, setResp] = useState({});
  const totalPreguntas = PREGUNTAS.length;

  const seccionActual = paso < totalPreguntas ? PREGUNTAS[paso].seccion : 'resultado';
  const seccionIdx = SECCIONES.findIndex((s) => s.id === seccionActual);

  function elegir(valor) {
    const campo = PREGUNTAS[paso].campo;
    setResp({ ...resp, [campo]: valor });
    if (paso < totalPreguntas - 1) setPaso(paso + 1);
    else setPaso(totalPreguntas);
  }

  const resultado = paso >= totalPreguntas ? calcular(resp) : null;

  return (
    <div className="calc-fondo">
      <aside className="calc-sidebar">
        <Link to="/" className="calc-logo" aria-label="Gestión RSU — Inicio">
          <img src="/logo.svg" alt="Gestión RSU" height="36" style={{ display: 'block' }} />
        </Link>
        <ol className="calc-pasos">
          {SECCIONES.map((s, i) => (
            <li key={s.id} className={i === seccionIdx ? 'activo' : i < seccionIdx ? 'hecho' : ''}>
              <span className="calc-num">{i + 1}</span>
              <span>{s.label}</span>
            </li>
          ))}
        </ol>
      </aside>

      <main className="calc-main">
        <div className="calc-header">
          <h1>Calculadora de huella de carbono</h1>
          <span className="calc-progreso">{paso < totalPreguntas ? `${paso + 1} / ${totalPreguntas}` : 'Resultado'}</span>
        </div>
        <div className="calc-barra"><i style={{ width: `${((paso + 1) / (totalPreguntas + 1)) * 100}%` }} /></div>

        {paso < totalPreguntas ? (
          <div className="calc-pregunta">
            <span className="calc-seccion-tag">{SECCIONES[seccionIdx]?.label}</span>
            <h2>{PREGUNTAS[paso].label}</h2>
            <div className="calc-opciones">
              {PREGUNTAS[paso].opciones.map((op) => (
                <button
                  key={op}
                  type="button"
                  className={`calc-opcion${resp[PREGUNTAS[paso].campo] === op ? ' seleccionada' : ''}`}
                  onClick={() => elegir(op)}
                >
                  {op}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="calc-resultado">
            <h2>Tu huella de carbono estimada</h2>
            <div className="calc-total">
              <span className="calc-numero">{resultado.total.toFixed(1)}</span>
              <span className="calc-unidad">tCO₂e / año</span>
            </div>
            <div className="calc-desglose">
              <div className="calc-cat">
                <span className="calc-cat-label">Energía e instalaciones</span>
                <span className="calc-cat-valor">{resultado.energia.toFixed(1)} t</span>
              </div>
              <div className="calc-cat">
                <span className="calc-cat-label">Vehículos y transporte</span>
                <span className="calc-cat-valor">{resultado.vehiculos.toFixed(1)} t</span>
              </div>
              <div className="calc-cat">
                <span className="calc-cat-label">Residuos</span>
                <span className="calc-cat-valor">{resultado.residuos.toFixed(1)} t</span>
              </div>
            </div>
            <p className="calc-nota">Esta es una estimación orientativa basada en promedios del sector. Para un cálculo preciso según tu operación real, usá el módulo de huella de carbono dentro de la plataforma.</p>
            <div className="calc-acciones">
              <Link to="/register" className="primary button">Crear cuenta gratis</Link>
              <button type="button" className="secondary" onClick={() => { setPaso(0); setResp({}); }}>Volver a calcular</button>
            </div>
          </div>
        )}

        <div className="calc-nav">
          {paso > 0 && <button type="button" className="secondary" onClick={() => setPaso(paso - 1)}>Anterior</button>}
        </div>

        <p className="calc-disclaimer">Los datos se utilizan únicamente para estimar tu huella. No se almacenan ni se comparten.</p>
      </main>
    </div>
  );
}
