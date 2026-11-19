import { Router } from 'express';
import { z } from 'zod';
import { reporteMensual } from './snigei.service.js';
import { reporteAXlsx, XLSX_TYPE } from './snigei.xlsx.js';
import { Organization } from '../organizations/organization.model.js';
import { currentTenant } from '../../lib/tenancy.js';
import { requireRole } from '../../middleware/auth.js';

export const snigeiRouter = Router();
snigeiRouter.use(requireRole('administracion'));

const periodo = z.object({ anio: z.coerce.number().int().min(2020).max(2100), mes: z.coerce.number().int().min(1).max(12) });

snigeiRouter.get('/mensual', async (req, res) => {
  res.json(await reporteMensual(periodo.parse(req.query)));
});

snigeiRouter.get('/mensual.xlsx', async (req, res) => {
  const p = periodo.parse(req.query);
  const rep = await reporteMensual(p);
  const org = await Organization.findById(currentTenant()).select('nombre').lean();
  const buf = await reporteAXlsx(rep, org?.nombre || 'Organización');
  res.setHeader('Content-Type', XLSX_TYPE);
  res.setHeader('Content-Disposition', `attachment; filename="snigei-${p.anio}-${String(p.mes).padStart(2, '0')}.xlsx"`);
  res.send(buf);
});
