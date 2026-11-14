import { Router } from 'express';
import { z } from 'zod';
import { Client } from './client.model.js';
import { Organization } from '../organizations/organization.model.js';
import { User } from '../users/user.model.js';
import { requireRole } from '../../middleware/auth.js';
import { HttpError } from '../../middleware/error.js';
import { randomPassword, normalizarCuit } from '../../lib/passwords.js';

export const accesoPortalRouter = Router();

/**
 * La cooperativa le da acceso al portal a un cliente generador.
 * - Si otra cooperativa ya lo había dado de alta (mismo CUIT), se vincula a esa misma
 *   organización: el cliente ve en un solo portal los servicios de todas sus cooperativas.
 * - Crea un usuario `cliente_admin` con contraseña aleatoria, que se devuelve UNA vez para
 *   que la cooperativa se la pase al cliente. Más adelante: invitación por mail.
 */
accesoPortalRouter.post('/:id/acceso-portal', requireRole('administracion'), async (req, res) => {
  const data = z
    .object({ email: z.string().email(), nombre: z.string().min(2), tipo: z.enum(['empresa', 'municipio']).default('empresa') })
    .parse(req.body);

  const cliente = await Client.findById(req.params.id);
  if (!cliente) throw new HttpError(404, 'Cliente no encontrado');
  if (cliente.tipo === 'comprador') throw new HttpError(422, 'El portal es para clientes generadores, no para compradores');
  if (await User.exists({ email: data.email.toLowerCase() })) throw new HttpError(409, 'Ya existe un usuario con ese email');

  let org = cliente.organizacion ? await Organization.findById(cliente.organizacion) : null;
  let vinculadaExistente = Boolean(org);
  if (!org && cliente.cuit) {
    org = await Organization.findOne({ cuit: normalizarCuit(cliente.cuit) });
    if (org?.tipo === 'cooperativa') throw new HttpError(409, 'Ese CUIT corresponde a una cooperativa de la plataforma');
    vinculadaExistente = Boolean(org);
  }
  if (!org) {
    org = await Organization.create({ tipo: data.tipo, nombre: cliente.razonSocial, ...(cliente.cuit && { cuit: normalizarCuit(cliente.cuit) }) });
  }
  if (!cliente.organizacion) {
    cliente.organizacion = org._id;
    await cliente.save();
  }

  const password = randomPassword();
  await User.create({ nombre: data.nombre, email: data.email, rol: 'cliente_admin', organizacion: org._id, passwordHash: await User.hashPassword(password) });
  res.status(201).json({
    usuario: { email: data.email.toLowerCase(), nombre: data.nombre },
    password,
    organizacion: { id: org._id, nombre: org.nombre, tipo: org.tipo },
    vinculadaExistente,
  });
});
