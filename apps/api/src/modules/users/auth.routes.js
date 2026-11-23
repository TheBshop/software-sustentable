import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { User } from './user.model.js';
import { requireAuth, requireRole, rolesPara, rolDeToken, signToken } from '../../middleware/auth.js';
import { HttpError } from '../../middleware/error.js';
import { enviarMail } from '../../lib/mailer.js';
import { env } from '../../config/env.js';

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

// Tokens de reset en memoria (TTL 1h). En producción con múltiples instancias
// conviene moverlo a Redis o a un campo en el User, pero para un solo dyno alcanza.
const resetTokens = new Map();
const RESET_TTL = 60 * 60 * 1000;

authRouter.post('/forgot-password', async (req, res) => {
  const { email } = z.object({ email: z.string().email() }).parse(req.body);
  const user = await User.findOne({ email: email.toLowerCase(), activo: true });
  // Siempre responder OK para no revelar si el email existe
  if (!user) return res.json({ ok: true });
  const token = crypto.randomBytes(32).toString('hex');
  resetTokens.set(token, { userId: user._id.toString(), expires: Date.now() + RESET_TTL });
  const link = `${env.publicWebUrl}/reset-password?token=${token}`;
  await enviarMail({
    to: email.toLowerCase(),
    subject: 'Restablecer contraseña — Gestión RSU',
    text:
      `Hola ${user.nombre.split(' ')[0] || ''},\n\n` +
      `Recibimos un pedido para restablecer tu contraseña.\n\n` +
      `  Hacé clic acá: ${link}\n\n` +
      `El enlace es válido por 1 hora. Si no pediste esto, ignorá este mensaje.\n\n` +
      `Gestión RSU — Nueva Vida`,
  });
  res.json({ ok: true });
});

authRouter.post('/reset-password', async (req, res) => {
  const { token, password } = z.object({ token: z.string().min(1), password: z.string().min(8).max(100) }).parse(req.body);
  const entry = resetTokens.get(token);
  if (!entry || entry.expires < Date.now()) throw new HttpError(400, 'El enlace expiró o no es válido. Pedí uno nuevo.');
  const user = await User.findById(entry.userId).select('+passwordHash');
  if (!user) throw new HttpError(400, 'Usuario no encontrado');
  user.passwordHash = await User.hashPassword(password);
  user.debeCambiarPassword = false;
  await user.save();
  resetTokens.delete(token);
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
