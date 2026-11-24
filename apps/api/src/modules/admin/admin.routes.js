// Administración de la plataforma (SaaS): alta y baja de organizaciones y usuarios.
// Solo para usuarios `superadmin` de la organización "Plataforma".
import { Router } from 'express';
import { z } from 'zod';
import { Organization, ROLES_ORG } from '../organizations/organization.model.js';
import { User } from '../users/user.model.js';
import { requirePlataforma } from '../../middleware/auth.js';
import { HttpError } from '../../middleware/error.js';
import { altaOperador, crearUsuario, resetearPassword, TIPOS_OPERADOR } from '../organizations/alta.service.js';

export const adminRouter = Router();
adminRouter.use(requirePlataforma());

adminRouter.get('/organizaciones', async (req, res) => {
  const { rol } = z.object({ rol: z.enum(ROLES_ORG).optional() }).parse(req.query);
  const orgs = await Organization.find({ tipo: { $ne: 'plataforma' }, ...(rol && { rol }) }).sort('nombre').lean();
  const usuarios = await User.aggregate([{ $group: { _id: '$organizacion', total: { $sum: 1 }, activos: { $sum: { $cond: ['$activo', 1, 0] } } } }]);
  const porOrg = Object.fromEntries(usuarios.map((u) => [String(u._id), u]));
  res.json({
    items: orgs.map((o) => ({ id: o._id, tipo: o.tipo, rol: o.rol, nombre: o.nombre, cuit: o.cuit, activo: o.activo, jurisdiccion: o.jurisdiccion, usuarios: porOrg[String(o._id)]?.activos ?? 0, creada: o.createdAt })),
  });
});

const altaSchema = z.object({
  tipo: z.enum(TIPOS_OPERADOR),
  nombre: z.string().min(2),
  cuit: z.string().optional(),
  provincia: z.string().optional(),
  municipio: z.string().optional(),
  corrientes: z.array(z.string()).optional(),
  admin: z.object({ email: z.string().email(), nombre: z.string().min(2) }),
});

adminRouter.post('/organizaciones', async (req, res) => {
  const { org, admin } = await altaOperador(altaSchema.parse(req.body));
  res.status(201).json({ organizacion: { id: org._id, tipo: org.tipo, rol: org.rol, nombre: org.nombre }, admin });
});

adminRouter.get('/registros-recientes', async (req, res) => {
  const limite = Math.min(Number(req.query.limite) || 20, 100);
  const orgs = await Organization.find({ tipo: { $ne: 'plataforma' } }).sort('-createdAt').limit(limite).lean();
  const orgIds = orgs.map((o) => o._id);
  const admins = await User.find({ organizacion: { $in: orgIds }, rol: 'admin' }).select('nombre email organizacion ultimoLogin createdAt').lean();
  const adminPorOrg = Object.fromEntries(admins.map((u) => [String(u.organizacion), u]));
  res.json({
    items: orgs.map((o) => {
      const admin = adminPorOrg[String(o._id)];
      return {
        id: o._id, tipo: o.tipo, nombre: o.nombre, cuit: o.cuit, activo: o.activo,
        jurisdiccion: o.jurisdiccion, creada: o.createdAt,
        admin: admin ? { nombre: admin.nombre, email: admin.email, ultimoLogin: admin.ultimoLogin } : null,
      };
    }),
  });
});

adminRouter.delete('/organizaciones/:id', async (req, res) => {
  const org = await Organization.findOne({ _id: req.params.id, tipo: { $ne: 'plataforma' } });
  if (!org) throw new HttpError(404, 'Organización no encontrada');
  const { deletedCount } = await User.deleteMany({ organizacion: org._id });
  await org.deleteOne();
  res.json({ eliminada: true, usuariosEliminados: deletedCount });
});

adminRouter.patch('/organizaciones/:id', async (req, res) => {
  const data = z.object({ nombre: z.string().min(2).optional(), activo: z.boolean().optional() }).parse(req.body);
  const org = await Organization.findOneAndUpdate({ _id: req.params.id, tipo: { $ne: 'plataforma' } }, data, { new: true });
  if (!org) throw new HttpError(404, 'Organización no encontrada');
  res.json({ id: org._id, nombre: org.nombre, activo: org.activo });
});

adminRouter.get('/organizaciones/:id/usuarios', async (req, res) => {
  res.json({ items: await User.find({ organizacion: req.params.id }).sort('nombre').select('nombre email rol activo') });
});

adminRouter.post('/organizaciones/:id/usuarios', async (req, res) => {
  const data = z.object({ email: z.string().email(), nombre: z.string().min(2), rol: z.string() }).parse(req.body);
  const organizacion = await Organization.findById(req.params.id);
  if (!organizacion) throw new HttpError(404, 'Organización no encontrada');
  res.status(201).json(await crearUsuario({ organizacion, ...data }));
});

adminRouter.post('/usuarios/:id/password', async (req, res) => {
  res.json(await resetearPassword(req.params.id));
});

adminRouter.patch('/usuarios/:id', async (req, res) => {
  const { activo } = z.object({ activo: z.boolean() }).parse(req.body);
  const user = await User.findByIdAndUpdate(req.params.id, { activo }, { new: true });
  if (!user) throw new HttpError(404, 'Usuario no encontrado');
  res.json({ id: user._id, activo: user.activo });
});
