// Lectura y edición de los datos de la propia organización (CUIT, domicilio, IVA, registros).
// Lo usa el panel de "Primer ingreso" y la pantalla /mi-organizacion.
import { Router } from 'express';
import { z } from 'zod';
import { Organization } from './organization.model.js';
import { requireRole } from '../../middleware/auth.js';
import { currentTenant, runWithoutTenant } from '../../lib/tenancy.js';
import { HttpError } from '../../middleware/error.js';
import { normalizarCuit } from '../../lib/passwords.js';

const CONDICIONES_IVA = ['responsable_inscripto', 'monotributo', 'exento', 'consumidor_final'];

const datosFiscalesInput = z.object({
  cuit: z.string().optional(),
  domicilio: z.string().max(200).optional(),
  condicionIva: z.enum(CONDICIONES_IVA).optional(),
  certificado: z.object({
    responsable: z.string().max(100).optional(),
    cargo: z.string().max(100).optional(),
  }).partial().optional(),
  jurisdiccion: z.object({
    provincia: z.string().optional(),
    municipio: z.string().optional(),
    ciudad: z.string().max(100).optional(),
  }).partial().optional(),
});

export const miOrganizacionRouter = Router();

// GET /api/mi-organizacion → datos actuales. Cualquier usuario logueado los puede ver.
miOrganizacionRouter.get('/', async (req, res) => {
  const tid = currentTenant();
  const org = await runWithoutTenant(() => Organization.findById(tid).lean());
  if (!org) throw new HttpError(404, 'Organización no encontrada');
  res.json(org);
});

// PATCH /api/mi-organizacion → solo admin/administracion. Datos fiscales editables.
miOrganizacionRouter.patch('/', requireRole('administracion'), async (req, res) => {
  const data = datosFiscalesInput.parse(req.body);
  const tid = currentTenant();
  const org = await runWithoutTenant(() => Organization.findById(tid));
  if (!org) throw new HttpError(404, 'Organización no encontrada');
  if (data.cuit != null) {
    const cuit = normalizarCuit(data.cuit);
    if (cuit && !/^\d{11}$/.test(cuit)) throw new HttpError(422, 'CUIT inválido: debe tener 11 dígitos');
    if (cuit && cuit !== org.cuit) {
      const otro = await runWithoutTenant(() => Organization.findOne({ cuit, _id: { $ne: org._id } }));
      if (otro) throw new HttpError(409, 'Ese CUIT ya pertenece a otra organización');
    }
    org.cuit = cuit;
  }
  if (data.domicilio !== undefined) org.domicilio = data.domicilio;
  if (data.condicionIva) org.condicionIva = data.condicionIva;
  if (data.certificado) {
    org.certificado = { ...(org.certificado?.toObject?.() ?? org.certificado ?? {}), ...data.certificado };
  }
  if (data.jurisdiccion) {
    org.jurisdiccion = { ...(org.jurisdiccion?.toObject?.() ?? org.jurisdiccion ?? {}), ...data.jurisdiccion };
  }
  await org.save();
  res.json(org);
});
