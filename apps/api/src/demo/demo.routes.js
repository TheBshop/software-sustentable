// Modo demostración (DEMO_MODE=true): lista los prototipos y permite entrar a cada uno con
// un clic, sin contraseña, para mostrarlos en una reunión. NUNCA activar en producción con
// datos reales: cualquiera que llegue a la URL entra como administrador del prototipo.
import { Router } from 'express';
import { z } from 'zod';
import { Organization } from '../modules/organizations/organization.model.js';
import { User } from '../modules/users/user.model.js';
import { PROVINCIAS } from '../modules/normativa/jurisdicciones.js';
import { HttpError } from '../middleware/error.js';
import { sesion } from '../modules/users/auth.routes.js';
import { ENTIDADES, PERFILES } from './entidades.js';
import { emailsPrototipo } from './prototipos.js';

export const demoRouter = Router();

demoRouter.get('/prototipos', async (_req, res) => {
  const existentes = new Set((await Organization.find({ 'prototipo.slug': { $exists: true } }).select('prototipo.slug')).map((o) => o.prototipo.slug));
  res.json({
    items: ENTIDADES.filter((e) => existentes.has(e.slug)).map((e) => ({
      slug: e.slug,
      nombre: e.nombre,
      perfil: PERFILES[e.perfil],
      ciudad: e.ciudad,
      provincia: PROVINCIAS[e.jurisdiccion.provincia]?.nombre,
      materiales: e.materiales.length,
    })),
  });
});

demoRouter.post('/entrar', async (req, res) => {
  const { slug, rol } = z.object({ slug: z.string().min(2), rol: z.enum(['admin', 'chofer']).default('admin') }).parse(req.body);
  const user = await User.findOne({ email: emailsPrototipo(slug)[rol] }).populate('organizacion');
  if (!user?.organizacion?.prototipo?.slug) throw new HttpError(404, 'Prototipo no encontrado');
  res.json(sesion(user, user.organizacion));
});
