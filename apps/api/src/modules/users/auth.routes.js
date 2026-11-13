import { Router } from 'express';
import { z } from 'zod';
import { User } from './user.model.js';
import { ROLES, requireAuth, requireRole, signToken } from '../../middleware/auth.js';
import { HttpError } from '../../middleware/error.js';

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const { email, password } = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
  const user = await User.findOne({ email: email.toLowerCase(), activo: true }).select('+passwordHash');
  if (!user || !(await user.checkPassword(password))) throw new HttpError(401, 'Email o contraseña incorrectos');
  res.json({ token: signToken(user), user: { id: user._id, nombre: user.nombre, rol: user.rol } });
});

authRouter.get('/me', requireAuth, (req, res) => res.json(req.user));

// Alta de usuarios (solo admin). La cooperativa tiene pocos usuarios: no hace falta auto-registro.
export const usersRouter = Router();

usersRouter.get('/', requireRole(), async (_req, res) => {
  res.json({ items: await User.find().sort('nombre') });
});

usersRouter.post('/', requireRole(), async (req, res) => {
  const data = z
    .object({ nombre: z.string().min(2), email: z.string().email(), password: z.string().min(8), rol: z.enum(ROLES) })
    .parse(req.body);
  const user = await User.create({ ...data, passwordHash: await User.hashPassword(data.password) });
  res.status(201).json({ id: user._id, nombre: user.nombre, email: user.email, rol: user.rol });
});
