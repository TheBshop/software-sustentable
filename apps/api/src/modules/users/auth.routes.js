import { Router } from 'express';
import { z } from 'zod';
import { User } from './user.model.js';
import { requireAuth, requireRole, rolesPara, rolDeToken, signToken } from '../../middleware/auth.js';
import { HttpError } from '../../middleware/error.js';

export const authRouter = Router();

export const sesion = (user, org) => ({
  token: signToken(user, org),
  user: { id: user._id, nombre: user.nombre, rol: user.rol, debeCambiarPassword: !!user.debeCambiarPassword, organizacion: { id: org._id, nombre: org.nombre, tipo: org.tipo, rol: org.rol ?? (org.tipo === 'plataforma' ? 'plataforma' : ['cooperativa', 'recicladora'].includes(org.tipo) ? 'operador' : 'generador') } },
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
  const user = await User.findOne({ email: email.toLowerCase(), activo: true }).select('+passwordHash').populate('organizacion');
  if (!user || !(await user.checkPassword(password))) throw new HttpError(401, 'Email o contraseña incorrectos');
  if (!user.organizacion?.activo) throw new HttpError(403, 'La organización está dada de baja');
  res.json(sesion(user, user.organizacion));
});

authRouter.get('/me', requireAuth, (req, res) => res.json(req.user));

// Cambio de contraseña del propio usuario. Habilitado también para usuarios con
// `debeCambiarPassword: true` (primer ingreso tras alta por crear-piloto).
authRouter.post('/cambiar-password', requireAuth, async (req, res) => {
  const { actual, nueva } = z.object({ actual: z.string().min(1), nueva: z.string().min(8).max(100) }).parse(req.body);
  const user = await User.findById(req.user.sub).select('+passwordHash');
  if (!user || !(await user.checkPassword(actual))) throw new HttpError(401, 'La contraseña actual es incorrecta');
  user.passwordHash = await User.hashPassword(nueva);
  user.debeCambiarPassword = false;
  await user.save();
  res.json({ ok: true });
});

// Usuarios de la propia organización. Las cooperativas los gestionan acá; los clientes
// (empresa/municipio) lo hacen desde el portal con el mismo criterio.
export const usersRouter = Router();

usersRouter.get('/', requireRole('cliente_admin'), async (req, res) => {
  res.json({ items: await User.find({ organizacion: req.user.org }).sort('nombre') });
});

usersRouter.post('/', requireRole('cliente_admin'), async (req, res) => {
  const data = z
    .object({ nombre: z.string().min(2), email: z.string().email(), password: z.string().min(8), rol: z.enum(rolesPara(rolDeToken(req.user))) })
    .parse(req.body);
  const user = await User.create({ ...data, organizacion: req.user.org, passwordHash: await User.hashPassword(data.password) });
  res.status(201).json({ id: user._id, nombre: user.nombre, email: user.email, rol: user.rol });
});
