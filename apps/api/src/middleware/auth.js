import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError } from './error.js';

// Roles según el tipo de organización del usuario
export const ROLES_COOPERATIVA = ['admin', 'administracion', 'operador_planta', 'chofer'];
export const ROLES_CLIENTE = ['cliente_admin', 'cliente']; // empresas y municipios (portal)
export const ROLES_VECINO = ['vecino']; // ciudadanos
export const ROLES_PLATAFORMA = ['superadmin']; // administradores del SaaS
export const ROLES = [...ROLES_COOPERATIVA, ...ROLES_CLIENTE, ...ROLES_VECINO, ...ROLES_PLATAFORMA];
export const OWNER_EMAIL = 'valentinoruberto@gmail.com';

/** Recibe el rol de la organización ('operador' / 'generador') o, en tokens viejos, su tipo. */
export const rolesPara = (rolOTipo) => {
  if (['operador', 'cooperativa'].includes(rolOTipo)) return ROLES_COOPERATIVA;
  if (rolOTipo === 'plataforma') return ROLES_PLATAFORMA;
  if (rolOTipo === 'vecino') return ROLES_VECINO;
  return ROLES_CLIENTE;
};

/** Rol de la organización del token; los tokens anteriores al campo `orgRol` se deducen del tipo. */
export const rolDeToken = (u) => u?.orgRol ?? (u?.orgTipo === 'cooperativa' ? 'operador' : u?.orgTipo ? 'generador' : null);

/** `org` es la organización del usuario (populada). */
export function signToken(user, org) {
  const orgRol = org.rol ?? (org.tipo === 'plataforma' ? 'plataforma' : ['cooperativa', 'recicladora'].includes(org.tipo) ? 'operador' : 'generador');
  const esSuperadminReal = user.rol === 'superadmin' && orgRol === 'plataforma' && user.email?.toLowerCase() === OWNER_EMAIL;
  const role = esSuperadminReal ? 'superadmin' : user.rol === 'superadmin' ? 'admin' : user.rol;
  return jwt.sign(
    { sub: String(user._id), role, nombre: user.nombre, org: String(org._id), orgTipo: org.tipo, orgRol, orgNombre: org.nombre },
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

/** Zona de gestión: organizaciones operadoras (cooperativa, recicladora o municipio). */
export const requireOperador = () => (req, _res, next) =>
  rolDeToken(req.user) === 'operador' ? next() : next(new HttpError(403, 'Esta sección es para organizaciones que gestionan residuos'));

/** Portal: organizaciones generadoras (clientes de un operador). */
export const requireGenerador = () => (req, _res, next) =>
  rolDeToken(req.user) === 'generador' ? next() : next(new HttpError(403, 'El portal es para generadores'));

/** Administración del SaaS: superadmin de la organización "Plataforma". */
export const requirePlataforma = () => (req, _res, next) =>
  rolDeToken(req.user) === 'plataforma' && req.user?.role === 'superadmin' ? next() : next(new HttpError(403, 'Solo para administradores de la plataforma'));

/** El rol `admin` pasa si su organización es operadora (no plataforma, ni generador, ni vecino). */
export const requireRole =
  (...roles) =>
  (req, _res, next) =>
    (req.user?.role === 'admin' && rolDeToken(req.user) === 'operador') || roles.includes(req.user?.role)
      ? next()
      : next(new HttpError(403, 'Sin permisos para esta acción'));
