import { useId, useRef, useState } from 'react';

/** Ícono "i": al pasar el mouse, enfocar o tocar muestra una explicación breve. */
export default function Ayuda({ children, label = 'Más información' }) {
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const id = useId();
  const abrir = () => {
    const r = ref.current.getBoundingClientRect();
    const ancho = Math.min(300, window.innerWidth - 24);
    setPos({ left: Math.max(12, Math.min(r.left + r.width / 2 - ancho / 2, window.innerWidth - ancho - 12)), top: r.bottom + 8, maxWidth: ancho });
  };
  const cerrar = () => setPos(null);
  return (
    <>
      <button
        ref={ref}
        type="button"
        className="ayuda-i"
        aria-label={label}
        aria-expanded={Boolean(pos)}
        aria-describedby={pos ? id : undefined}
        onMouseEnter={abrir}
        onMouseLeave={cerrar}
        onFocus={abrir}
        onBlur={cerrar}
        onClick={() => (pos ? cerrar() : abrir())}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="M12 11v6" />
          <path d="M12 7h.01" />
        </svg>
      </button>
      {pos && (
        <span role="tooltip" id={id} className="tip" style={pos}>
          {children}
        </span>
      )}
    </>
  );
}
