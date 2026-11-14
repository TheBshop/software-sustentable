import { Router } from 'express';
import { z } from 'zod';
import { Certificate } from './certificate.model.js';
import { publicView, sendCertificate } from './certificate.service.js';
import { renderCertificatePdf } from './certificate.pdf.js';
import { requireRole } from '../../middleware/auth.js';
import { HttpError } from '../../middleware/error.js';

// ---------- Rutas internas (requieren login) ----------
export const certificatesRouter = Router();

certificatesRouter.get('/', async (req, res) => {
  const query = typeof req.query.cliente === 'string' ? { cliente: req.query.cliente } : {};
  res.json({ items: await Certificate.find(query).sort('-createdAt').limit(200) });
});

certificatesRouter.get('/:id/pdf', async (req, res) => {
  const cert = await Certificate.findById(req.params.id);
  if (!cert) throw new HttpError(404, 'Certificado no encontrado');
  res.type('application/pdf').setHeader('Content-Disposition', `inline; filename="certificado-${cert.numero}.pdf"`);
  await renderCertificatePdf(cert, res);
});

certificatesRouter.post('/:id/enviar', requireRole('administracion', 'operador_planta'), async (req, res) => {
  const data = z
    .discriminatedUnion('canal', [
      z.object({ canal: z.literal('email'), destino: z.string().email() }),
      z.object({ canal: z.literal('whatsapp'), destino: z.string().min(8) }),
    ])
    .parse(req.body);
  const cert = await Certificate.findById(req.params.id);
  if (!cert) throw new HttpError(404, 'Certificado no encontrado');
  res.json(await sendCertificate(cert, data));
});

certificatesRouter.post('/:id/anular', requireRole('administracion'), async (req, res) => {
  const cert = await Certificate.findByIdAndUpdate(req.params.id, { anulado: true }, { new: true });
  if (!cert) throw new HttpError(404, 'Certificado no encontrado');
  res.json(cert);
});

// ---------- Rutas públicas (validación por QR) ----------
export const publicCertificatesRouter = Router();

publicCertificatesRouter.get('/:codigo', async (req, res) => {
  const cert = await Certificate.findOne({ codigo: req.params.codigo }).setOptions({ sinTenant: true }); // público: el código del QR identifica al certificado sin importar la cooperativa
  if (!cert) throw new HttpError(404, 'Certificado inexistente');
  res.json(publicView(cert));
});

publicCertificatesRouter.get('/:codigo/pdf', async (req, res) => {
  const cert = await Certificate.findOne({ codigo: req.params.codigo }).setOptions({ sinTenant: true }); // público: el código del QR identifica al certificado sin importar la cooperativa
  if (!cert) throw new HttpError(404, 'Certificado inexistente');
  res.type('application/pdf').setHeader('Content-Disposition', `attachment; filename="certificado-${cert.numero}.pdf"`);
  await renderCertificatePdf(cert, res);
});
