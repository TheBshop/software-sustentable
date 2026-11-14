import { Router } from 'express';
import { z } from 'zod';
import { User } from './user.model.js';
import { requireAuth, requireRole, rolesPara, signToken } from '../../middleware/auth.js';
import { HttpError } from '../../middleware/error.js';

export const authRouter = Router();

const sesion = (user, org) => ({
  token: signToken(user, org),
  user: { id: user._id, nombre: user.nombre, rol: user.rol, organizacion: { id: org._id, nombre: org.nombre, tipo: org.tipo } },
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
  const user = await User.findOne({ email: email.toLowerCase(), activo: true }).select('+passwordHash').populate('organizacion');
  if (!user || !(await user.checkPassword(password))) throw new HttpError(401, 'Email o contraseña incorrectos');
  if (!user.organizacion?.activo) throw new HttpError(403, 'La organización está dada de baja');
  res.json(sesion(user, user.organizacion));
});

authRouter.get('/me', requireAuth, (req, res) => res.json(req.user));

// Usuarios de la propia organización. Las cooperativas los gestionan acá; los clientes
// (empresa/municipio) lo hacen desde el portal con el mismo criterio.
export const usersRouter = Router();

usersRouter.get('/', requireRole('cliente_admin'), async (req, res) => {
  res.json({ items: await User.find({ organizacion: req.user.org }).sort('nombre') });
});

usersRouter.post('/', requireRole('cliente_admin'), async (req, res) => {
  const data = z
    .object({ nombre: z.string().min(2), email: z.string().email(), password: z.string().min(8), rol: z.enum(rolesPara(req.user.orgTipo)) })
    .parse(req.body);
  const user = await User.create({ ...data, organizacion: req.user.org, passwordHash: await User.hashPassword(data.password) });
  res.status(201).json({ id: user._id, nombre: user.nombre, email: user.email, rol: user.rol });
});
