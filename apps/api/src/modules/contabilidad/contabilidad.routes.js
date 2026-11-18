// Contabilidad para el contador (solo administración). Se monta en /api/contabilidad:
//   GET /libro-iva-ventas[.xlsx]?desde&hasta · GET /libro-iva-compras[.xlsx]?desde&hasta
//   GET /mayor[.xlsx]?cuenta=caja|ventas|gastos|clientes&desde&hasta
import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../../middleware/auth.js';
import { HttpError } from '../../middleware/error.js';
import { dateInput, endOfLocalDay, startOfLocalMonth } from '../../lib/validation.js';
import { CUENTAS, libroVentas, libroCompras, mayor } from './contabilidad.service.js';
import { XLSX_TYPE, xlsxLibroVentas, xlsxLibroCompras, xlsxMayor } from './contabilidad.xlsx.js';

export const contabilidadRouter = Router();
contabilidadRouter.use(requireRole('administracion'));

const periodoQ = z.object({ desde: dateInput.optional(), hasta: dateInput.optional() });
const periodo = (q) => {
  const p = periodoQ.parse(q);
  const desde = p.desde ?? startOfLocalMonth();
  const hasta = p.hasta ? endOfLocalDay(p.hasta) : new Date();
  if (desde > hasta) throw new HttpError(400, '"desde" no puede ser posterior a "hasta"');
  return { desde, hasta };
};
const cuentaQ = z.object({ cuenta: z.enum(CUENTAS, { message: `cuenta debe ser una de: ${CUENTAS.join(', ')}` }) });

const xlsx = (res, nombre, buf) => res.type(XLSX_TYPE).setHeader('Content-Disposition', `attachment; filename="${nombre}.xlsx"`).send(buf);
const sufijo = (p) => `${p.desde.toISOString().slice(0, 10)}_${p.hasta.toISOString().slice(0, 10)}`;

for (const [ruta, calcular, render] of [
  ['libro-iva-ventas', libroVentas, xlsxLibroVentas],
  ['libro-iva-compras', libroCompras, xlsxLibroCompras],
]) {
  contabilidadRouter.get(`/${ruta}`, async (req, res) => {
    const p = periodo(req.query);
    res.json(await calcular(p.desde, p.hasta));
  });
  contabilidadRouter.get(`/${ruta}.xlsx`, async (req, res) => {
    const p = periodo(req.query);
    xlsx(res, `${ruta}-${sufijo(p)}`, await render(await calcular(p.desde, p.hasta)));
  });
}

contabilidadRouter.get('/mayor', async (req, res) => {
  const { cuenta } = cuentaQ.parse(req.query);
  const p = periodo(req.query);
  res.json(await mayor(cuenta, p.desde, p.hasta));
});
contabilidadRouter.get('/mayor.xlsx', async (req, res) => {
  const { cuenta } = cuentaQ.parse(req.query);
  const p = periodo(req.query);
  xlsx(res, `mayor-${cuenta}-${sufijo(p)}`, await xlsxMayor(await mayor(cuenta, p.desde, p.hasta)));
});
