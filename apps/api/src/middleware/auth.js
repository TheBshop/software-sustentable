import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError } from './error.js';

export const ROLES = ['admin', 'administracion', 'operador_planta', 'chofer'];

export function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.rol, nombre: user.nombre }, env.jwtSecret, {
    expiresIn: '30d',
  });
}

export function requireAuth(req, _res, next) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'No autenticado'));
  try {
    req.user = jwt.verify(token, env.jwtSecret);
    next();
  } catch {
    next(new HttpError(401, 'Token inválido o vencido'));
  }
}

/** El rol `admin` siempre pasa. */
export const requireRole =
  (...roles) =>
  (req, _res, next) =>
    req.user?.role === 'admin' || roles.includes(req.user?.role)
      ? next()
      : next(new HttpError(403, 'Sin permisos para esta acción'));
