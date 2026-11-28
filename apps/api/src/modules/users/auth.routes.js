import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { User } from './user.model.js';
import { requireAuth, requireRole, rolesPara, rolDeToken, signToken, OWNER_EMAIL } from '../../middleware/auth.js';
import { HttpError } from '../../middleware/error.js';
import { enviarMail } from '../../lib/mailer.js';
import { env } from '../../config/env.js';
import { altaOperador, TIPOS_OPERADOR } from '../organizations/alta.service.js';

export const authRouter = Router();

const RESET_TTL = 60 * 60 * 1000; // 1 hora
const MAX_INTENTOS_LOGIN = 5;
const BLOQUEO_MINUTOS = 15;

const passwordSchema = z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(100);

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export const sesion = (user, org) => {
  if (!org) throw new HttpError(403, 'La organización del usuario no existe');
  const orgRol = org.rol ?? (org.tipo === 'plataforma' ? 'plataforma' : ['cooperativa', 'recicladora'].includes(org.tipo) ? 'operador' : 'generador');
  const esSuperadminReal = user.rol === 'superadmin' && orgRol === 'plataforma' && user.email?.toLowerCase() === OWNER_EMAIL;
  const rolEfectivo = esSuperadminReal ? 'superadmin' : user.rol === 'superadmin' ? 'admin' : user.rol;
  return {
    token: signToken(user, org),
    user: { id: user._id, nombre: user.nombre, rol: rolEfectivo, debeCambiarPassword: !!user.debeCambiarPassword, organizacion: { id: org._id, nombre: org.nombre, tipo: org.tipo, rol: orgRol } },
  };
};

authRouter.post('/login', async (req, res) => {
  const { email, password } = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
  const user = await User.findOne({ email: email.toLowerCase(), activo: true })
    .select('+passwordHash +loginIntentosFallidos +loginBloqueadoHasta')
    .populate('organizacion');

  if (!user) throw new HttpError(401, 'Email o contraseña incorrectos');

  // Bloqueo temporal tras intentos fallidos
  if (user.loginBloqueadoHasta && user.loginBloqueadoHasta > new Date()) {
    const minutos = Math.ceil((user.loginBloqueadoHasta - Date.now()) / 60000);
    throw new HttpError(429, `Cuenta bloqueada temporalmente. Intentá de nuevo en ${minutos} minuto${minutos === 1 ? '' : 's'}.`);
  }

  if (!(await user.checkPassword(password))) {
    const intentos = (user.loginIntentosFallidos ?? 0) + 1;
    const update = { loginIntentosFallidos: intentos };
    if (intentos >= MAX_INTENTOS_LOGIN) {
      update.loginBloqueadoHasta = new Date(Date.now() + BLOQUEO_MINUTOS * 60 * 1000);
      update.loginIntentosFallidos = 0;
    }
    await User.updateOne({ _id: user._id }, update);
    if (intentos >= MAX_INTENTOS_LOGIN) {
      throw new HttpError(429, `Demasiados intentos fallidos. La cuenta se bloqueó por ${BLOQUEO_MINUTOS} minutos.`);
    }
    throw new HttpError(401, 'Email o contraseña incorrectos');
  }

  if (!user.organizacion?.activo) throw new HttpError(403, 'La organización está dada de baja');

  // Login exitoso: resetear contador y registrar timestamp
  await User.updateOne({ _id: user._id }, { loginIntentosFallidos: 0, loginBloqueadoHasta: null, ultimoLogin: new Date() });
  res.json(sesion(user, user.organizacion));
});

authRouter.post('/register', async (req, res) => {
  const data = z.object({
    tipo: z.enum(TIPOS_OPERADOR),
    nombre: z.string().min(2, 'Nombre de la organización requerido'),
    cuit: z.string().optional(),
    admin: z.object({
      nombre: z.string().min(2, 'Tu nombre es requerido'),
      email: z.string().email('Email inválido'),
      password: passwordSchema,
    }),
  }).parse(req.body);

  const { org, admin } = await altaOperador({
    tipo: data.tipo,
    nombre: data.nombre,
    cuit: data.cuit,
    admin: { nombre: data.admin.nombre, email: data.admin.email },
  });

  // Setear la contraseña elegida por el usuario (altaOperador genera una al azar)
  const user = await User.findById(admin.id);
  user.passwordHash = await User.hashPassword(data.admin.password);
  user.debeCambiarPassword = false;
  await user.save();

  const orgDoc = await user.populate('organizacion');
  res.status(201).json(sesion(user, orgDoc.organizacion));
});

authRouter.post('/register-vecino', async (req, res) => {
  const data = z.object({
    nombre: z.string().min(2, 'Tu nombre es requerido'),
    email: z.string().email('Email inválido'),
    password: passwordSchema,
    provincia: z.string().min(2, 'Elegí tu provincia'),
    municipio: z.string().optional(),
  }).parse(req.body);

  if (await User.exists({ email: data.email.toLowerCase() })) throw new HttpError(409, 'Ya existe un usuario con ese email');

  const { Organization } = await import('../organizations/organization.model.js');
  const org = await Organization.create({
    tipo: 'vecino',
    rol: 'vecino',
    nombre: data.nombre,
    jurisdiccion: { provincia: data.provincia, municipio: data.municipio },
  });
  const user = await User.create({
    nombre: data.nombre,
    email: data.email.toLowerCase(),
    rol: 'vecino',
    organizacion: org._id,
    passwordHash: await User.hashPassword(data.password),
    debeCambiarPassword: false,
  });
  res.status(201).json(sesion(user, org));
});

authRouter.get('/me', requireAuth, (req, res) => res.json(req.user));

authRouter.post('/cambiar-password', requireAuth, async (req, res) => {
  const { actual, nueva } = z.object({ actual: z.string().min(1), nueva: passwordSchema }).parse(req.body);
  const user = await User.findById(req.user.sub).select('+passwordHash');
  if (!user || !(await user.checkPassword(actual))) throw new HttpError(401, 'La contraseña actual es incorrecta');
  user.passwordHash = await User.hashPassword(nueva);
  user.debeCambiarPassword = false;
  await user.save();
  res.json({ ok: true });
});

authRouter.post('/forgot-password', async (req, res) => {
  const { email } = z.object({ email: z.string().email() }).parse(req.body);
  const user = await User.findOne({ email: email.toLowerCase(), activo: true });
  // Siempre responder OK para no revelar si el email existe
  if (!user) return res.json({ ok: true });

  // Generar token, guardar hash en la base (el token plano va en el mail)
  const token = crypto.randomBytes(32).toString('hex');
  user.resetToken = hashToken(token);
  user.resetTokenExpires = new Date(Date.now() + RESET_TTL);
  await user.save();

  const link = `${env.publicWebUrl}/reset-password?token=${token}`;
  const nombre = user.nombre.split(' ')[0] || '';
  await enviarMail({
    to: email.toLowerCase(),
    subject: 'Restablecer contraseña — Gestión RSU',
    text:
      `Hola ${nombre},\n\n` +
      `Recibimos un pedido para restablecer tu contraseña.\n\n` +
      `  Hacé clic acá: ${link}\n\n` +
      `El enlace es válido por 1 hora. Si no pediste esto, ignorá este mensaje.\n\n` +
      `Gestión RSU — Nueva Vida`,
    html:
      `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">` +
      `<div style="background:#2f7d32;padding:16px 24px;border-radius:8px 8px 0 0">` +
      `<h2 style="color:#fff;margin:0;font-size:18px">Gestión RSU</h2></div>` +
      `<div style="border:1px solid #e5e7eb;border-top:0;padding:24px;border-radius:0 0 8px 8px">` +
      `<p>Hola ${nombre},</p>` +
      `<p>Recibimos un pedido para restablecer tu contraseña.</p>` +
      `<p style="text-align:center;margin:24px 0">` +
      `<a href="${link}" style="background:#2f7d32;color:#fff;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">Restablecer contraseña</a></p>` +
      `<p style="font-size:13px;color:#6b7280">El enlace es válido por 1 hora. Si no pediste esto, ignorá este mensaje.</p>` +
      `<p style="font-size:13px;color:#6b7280">Si el botón no funciona, copiá este enlace:<br>` +
      `<a href="${link}" style="color:#2f7d32;word-break:break-all">${link}</a></p>` +
      `</div></div>`,
  });
  res.json({ ok: true });
});

authRouter.post('/reset-password', async (req, res) => {
  const { token, password } = z.object({ token: z.string().min(1), password: passwordSchema }).parse(req.body);
  const hashed = hashToken(token);
  const user = await User.findOne({
    resetToken: hashed,
    resetTokenExpires: { $gt: new Date() },
    activo: true,
  }).select('+passwordHash +resetToken +resetTokenExpires');
  if (!user) throw new HttpError(400, 'El enlace expiró o no es válido. Pedí uno nuevo.');

  user.passwordHash = await User.hashPassword(password);
  user.debeCambiarPassword = false;
  user.resetToken = undefined;
  user.resetTokenExpires = undefined;
  user.loginIntentosFallidos = 0;
  user.loginBloqueadoHasta = undefined;
  await user.save();
  res.json({ ok: true });
});

// Usuarios de la propia organización
export const usersRouter = Router();

usersRouter.get('/', requireRole('cliente_admin'), async (req, res) => {
  res.json({ items: await User.find({ organizacion: req.user.org }).sort('nombre') });
});

usersRouter.post('/', requireRole('cliente_admin'), async (req, res) => {
  const data = z
    .object({ nombre: z.string().min(2), email: z.string().email(), password: passwordSchema, rol: z.enum(rolesPara(rolDeToken(req.user))) })
    .parse(req.body);
  const { password, ...rest } = data;
  const user = await User.create({ ...rest, organizacion: req.user.org, passwordHash: await User.hashPassword(password) });
  res.status(201).json({ id: user._id, nombre: user.nombre, email: user.email, rol: user.rol });
});
