// Stock y margen por material: stock del libro de planta, precios promedio y margen.
import { fmtKg, fmtPeso } from '../../api.js';
import { useLoad, ErrorMsg } from '../../ui.jsx';
import Ayuda from '../../shell/Ayuda.jsx';
import { useOrg } from '../../shell/Shell.jsx';

const p = (v) => (v == null ? '—' : fmtPeso(v));

export default function Stock() {
  const { data, error } = useLoad('/comercial/stock');
  const { perfil } = useOrg();
  if (error) return <ErrorMsg error={error} />;
  if (!data) return <p className="muted">Cargando…</p>;
  const r = data.resumen;
  const compra = perfil === 'empresa' || data.items.some((f) => f.compradoKg > 0);
  return (
    <div className="stack">
      <div className="page-h">
        <div>
          <h2>Stock y margen<Ayuda>El stock sale del libro de la planta (ingresos − rechazos − ventas ± ajustes). Los precios son promedios ponderados de todas las ventas y compras; el valor del stock usa el último precio de venta o, si no hubo ventas, el de lista.</Ayuda></h2>
          <p className="muted">Por material, acumulado desde el primer registro.</p>
        </div>
      </div>
      <div className="kpis">
        <div className="kpi"><span>Stock para vender</span><strong>{fmtKg(r.stockKg)}</strong></div>
        <div className="kpi"><span>Valor estimado del stock</span><strong>{fmtPeso(r.valorStock)}</strong></div>
        <div className="kpi"><span>Ventas del mes</span><strong>{fmtPeso(r.ventasMes)}</strong></div>
        {r.margenMes != null && (
          <div className={`kpi ${r.margenMes < 0 ? 'mal' : ''}`}>
            <span>Margen bruto del mes<Ayuda>Lo vendido en el mes menos lo que costó comprarlo (al costo promedio de compra de cada material).</Ayuda></span>
            <strong>{fmtPeso(r.margenMes)}</strong>
          </div>
        )}
      </div>
      {data.negativos.length > 0 && <div className="aviso red"><span>Stock negativo en {data.negativos.join(', ')}: se vendió más de lo que figura ingresado. Revisá los registros.</span></div>}
      <div className="card flush table-wrap">
        <table>
          <thead>
            <tr>
              <th>Material</th>
              {compra && <th className="r">Comprado</th>}
              <th className="r">Vendido</th>
              <th className="r">Stock</th>
              <th className="r">Precio de venta</th>
              {compra && <th className="r">Costo de compra</th>}
              {compra && <th className="r">Margen por kg</th>}
              <th className="r">Valor del stock</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((f) => (
              <tr key={f.materialId}>
                <td>{f.material}</td>
                {compra && <td className="r num">{f.compradoKg ? fmtKg(f.compradoKg) : '—'}</td>}
                <td className="r num">{fmtKg(f.vendidoKg)}</td>
                <td className={`r num ${f.stockKg < 0 ? 'error' : ''}`}>{fmtKg(f.stockKg)}</td>
                <td className="r num">{p(f.precioVentaProm)}</td>
                {compra && <td className="r num">{p(f.costoCompraProm)}</td>}
                {compra && <td className={`r num ${f.margenKg < 0 ? 'error' : ''}`}>{p(f.margenKg)}</td>}
                <td className="r num">{p(f.valorStock)}</td>
              </tr>
            ))}
            {!data.items.length && <tr><td colSpan={8} className="muted">Sin movimientos de material.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
