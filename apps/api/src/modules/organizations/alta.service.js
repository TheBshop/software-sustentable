// Alta de organizaciones y usuarios. La usan el administrador de la plataforma (/api/admin)
// y los comandos crear-cooperativa / crear-superadmin. Las contraseñas se generan al azar y se
// devuelven una sola vez.
import { PROV } from '@nueva-vida/catalogos';
import { Organization, CORRIENTES } from './organization.model.js';
import { User } from '../users/user.model.js';
import { ROLES_COOPERATIVA } from '../../middleware/auth.js';
import { randomPassword, normalizarCuit } from '../../lib/passwords.js';
import { HttpError } from '../../middleware/error.js';

export const TIPOS_OPERADOR = ['cooperativa', 'recicladora', 'municipio'];
const PERFIL_POR_TIPO = { cooperativa: 'cooperativa', recicladora: 'empresa', municipio: 'planta_publica' };

/** Crea una organización operadora con su primer administrador. */
export async function altaOperador({ tipo = 'cooperativa', nombre, cuit, perfil, corrientes = ['rsu'], provincia, municipio, admin }) {
  if (!TIPOS_OPERADOR.includes(tipo)) throw new HttpError(422, `Tipo inválido: ${tipo}. Opciones: ${TIPOS_OPERADOR.join(', ')}`);
  const invalidas = corrientes.filter((c) => !CORRIENTES.includes(c));
  if (invalidas.length) throw new HttpError(422, `Corrientes inválidas: ${invalidas.join(', ')}. Opciones: ${CORRIENTES.join(', ')}`);
  if (provincia && !PROV[provincia]) throw new HttpError(422, `Provincia desconocida: ${provincia}`);
  if (cuit && (await Organization.exists({ cuit: normalizarCuit(cuit) }))) throw new HttpError(409, `Ya existe una organización con CUIT ${cuit}`);
  if (await User.exists({ email: admin.email.toLowerCase() })) throw new HttpError(409, `Ya existe un usuario con email ${admin.email}`);
  const org = await Organization.create({
    tipo,
    rol: 'operador',
    perfil: perfil ?? PERFIL_POR_TIPO[tipo],
    nombre,
    ...(cuit && { cuit: normalizarCuit(cuit) }),
    habilitaciones: { corrientes },
    ...(provincia && { jurisdiccion: { provincia, municipio } }),
  });
  const usuario = await crearUsuario({ organizacion: org, email: admin.email, nombre: admin.nombre, rol: 'admin' });
  return { org, admin: usuario };
}

/** Crea un usuario en una organización existente. */
export async function crearUsuario({ organizacion, email, nombre, rol }) {
  const permitidos = organizacion.rol === 'plataforma' ? ['superadmin'] : organizacion.rol === 'operador' ? ROLES_COOPERATIVA : ['cliente_admin', 'cliente'];
  if (!permitidos.includes(rol)) throw new HttpError(422, `Rol inválido para esta organización. Opciones: ${permitidos.join(', ')}`);
  if (await User.exists({ email: email.toLowerCase() })) throw new HttpError(409, `Ya existe un usuario con email ${email}`);
  const password = randomPassword();
  const user = await User.create({ nombre, email, rol, organizacion: organizacion._id, passwordHash: await User.hashPassword(password) });
  return { id: user._id, email: user.email, nombre: user.nombre, rol: user.rol, password };
}

/** Genera una contraseña nueva para un usuario. */
export async function resetearPassword(userId) {
  const user = await User.findById(userId);
  if (!user) throw new HttpError(404, 'Usuario no encontrado');
  const password = randomPassword();
  user.passwordHash = await User.hashPassword(password);
  await user.save();
  return { id: user._id, email: user.email, password };
}

/** La organización "Plataforma" donde viven los administradores del SaaS (se crea una sola vez). */
export async function organizacionPlataforma() {
  return (await Organization.findOne({ tipo: 'plataforma' })) ?? Organization.create({ tipo: 'plataforma', rol: 'plataforma', nombre: 'Plataforma' });
}
