// Resultados: indicadores del período, huella de carbono, emisiones evitadas, informe por
// cliente y memoria anual (JSON, PDF y Excel).
import { Router } from 'express';
import { z } from 'zod';
import { huellaAnual, evitadasAnuales, memoriaAnual, informePorCliente } from './resultados.service.js';
import { panelResultados } from './panel.service.js';
import { renderMemoriaPdf } from './memoria.pdf.js';
import { renderMemoriaXlsx } from './memoria.xlsx.js';
import { Organization } from '../organizations/organization.model.js';
import { currentTenant } from '../../lib/tenancy.js';

export const resultadosRouter = Router();

const anioQ = z.object({ anio: z.coerce.number().int().min(2000).max(3000).default(new Date().getFullYear()) });

/** Panel de resultados estilo tablero: KPIs del período vs. anterior, fracción y evolución. */
resultadosRouter.get('/panel', async (req, res) => {
  const { periodo } = z.object({ periodo: z.string().regex(/^\d{4}(?:-\d{2})?$/).optional() }).parse(req.query);
  res.json(await panelResultados(periodo));
});

resultadosRouter.get('/huella', async (req, res) => {
  const { anio } = anioQ.parse(req.query);
  res.json(await huellaAnual(anio));
});

resultadosRouter.get('/evitadas', async (req, res) => {
  const { anio } = anioQ.parse(req.query);
  res.json(await evitadasAnuales(anio));
});

resultadosRouter.get('/informe-clientes', async (req, res) => {
  const { anio } = anioQ.parse(req.query);
  res.json(await informePorCliente(anio));
});

resultadosRouter.get('/memoria', async (req, res) => {
  const { anio } = anioQ.parse(req.query);
  res.json(await memoriaAnual(anio));
});

resultadosRouter.get('/memoria.pdf', async (req, res) => {
  const { anio } = anioQ.parse(req.query);
  const [org, m] = await Promise.all([Organization.findById(currentTenant()).lean(), memoriaAnual(anio)]);
  res.type('application/pdf').setHeader('Content-Disposition', `inline; filename="memoria-${anio}.pdf"`);
  renderMemoriaPdf(org, m, res);
});

resultadosRouter.get('/memoria.xlsx', async (req, res) => {
  const { anio } = anioQ.parse(req.query);
  const [org, m] = await Promise.all([Organization.findById(currentTenant()).lean(), memoriaAnual(anio)]);
  res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').setHeader('Content-Disposition', `attachment; filename="memoria-${anio}.xlsx"`);
  await renderMemoriaXlsx(org, m, res);
});
