import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError } from './error.js';

// Roles según el tipo de organización del usuario
export const ROLES_COOPERATIVA = ['admin', 'administracion', 'operador_planta', 'chofer'];
export const ROLES_CLIENTE = ['cliente_admin', 'cliente']; // empresas y municipios (portal)
export const ROLES = [...ROLES_COOPERATIVA, ...ROLES_CLIENTE];

export const rolesPara = (tipoOrg) => (tipoOrg === 'cooperativa' ? ROLES_COOPERATIVA : ROLES_CLIENTE);

/** `org` es la organización del usuario (populada). */
export function signToken(user, org) {
  return jwt.sign(
    { sub: String(user._id), role: user.rol, nombre: user.nombre, org: String(org._id), orgTipo: org.tipo, orgNombre: org.nombre },
    env.jwtSecret,
    { expiresIn: '30d' },
  );
}

export function requireAuth(req, _res, next) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'No autenticado'));
  try {
    req.user = jwt.verify(token, env.jwtSecret);
    if (!req.user.org) throw new Error('token sin organización');
    next();
  } catch {
    next(new HttpError(401, 'Token inválido o vencido'));
  }
}

/** Restringe una zona de la API a ciertos tipos de organización (cooperativa / empresa / municipio). */
export const requireOrgTipo =
  (...tipos) =>
  (req, _res, next) =>
    tipos.includes(req.user?.orgTipo) ? next() : next(new HttpError(403, 'Esta sección no está disponible para tu organización'));

/** El rol `admin` siempre pasa. */
export const requireRole =
  (...roles) =>
  (req, _res, next) =>
    req.user?.role === 'admin' || roles.includes(req.user?.role)
      ? next()
      : next(new HttpError(403, 'Sin permisos para esta acción'));
