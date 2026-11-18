// Importar desde Odoo: endpoints multipart por tipo (contactos|productos|facturas).
import { Router } from 'express';
import multer from 'multer';
import { HttpError } from '../../middleware/error.js';
import { requireRole } from '../../middleware/auth.js';
import { importarContactos, importarProductos, importarFacturas } from './importador-odoo.service.js';

const subir = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1 }, fileFilter: (_r, f, cb) => cb(null, /\.(csv|txt)$/i.test(f.originalname) || f.mimetype.includes('csv') || f.mimetype === 'text/plain') });

const HANDLERS = { contactos: importarContactos, productos: importarProductos, facturas: importarFacturas };

export const importOdooRouter = Router();
importOdooRouter.use(requireRole('administracion'));

importOdooRouter.post('/:tipo', subir.single('archivo'), async (req, res) => {
  const handler = HANDLERS[req.params.tipo];
  if (!handler) throw new HttpError(404, `Tipo inválido: ${req.params.tipo}. Opciones: ${Object.keys(HANDLERS).join(', ')}`);
  if (!req.file) throw new HttpError(422, 'Adjuntá el archivo CSV en el campo "archivo"');
  const texto = req.file.buffer.toString('utf8');
  const resumen = await handler(texto);
  res.json(resumen);
});
