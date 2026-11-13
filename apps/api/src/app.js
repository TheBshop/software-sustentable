import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/error.js';
import { crudRouter } from './lib/crud.js';
import { authRouter, usersRouter } from './modules/users/auth.routes.js';
import { Client, clientInput } from './modules/clients/client.model.js';
import { Material, materialInput } from './modules/materials/material.model.js';
import { Intake, intakeInput, Sale, saleInput } from './modules/plant/plant.models.js';
import { pickupsRouter } from './modules/pickups/pickup.routes.js';
import { certificatesRouter, publicCertificatesRouter } from './modules/certificates/certificate.routes.js';
import { invoicesRouter } from './modules/invoices/invoice.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';

/** `config` permite a los tests cambiar orígenes CORS o el límite de login sin tocar el entorno. */
export function createApp(config = {}) {
  const corsOrigins = config.corsOrigins ?? env.corsOrigins;
  const loginLimit = config.loginRateLimit ?? env.loginRateLimit;

  const app = express();
  app.set('trust proxy', 1); // Render/Railway/Fly ponen un proxy adelante: la IP real viene en X-Forwarded-For
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      // Sin lista configurada (desarrollo) se acepta cualquier origen. La app móvil no envía Origin.
      origin: (origin, cb) => cb(null, !corsOrigins.length || !origin || corsOrigins.includes(origin)),
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  if (env.nodeEnv !== 'test') app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

  app.get('/health', (_req, res) => res.json({ ok: true }));
  if (env.storage.driver === 'local') app.use('/uploads', express.static(env.uploadsDir));

  // ---- Públicas ----
  app.use(
    '/api/auth/login',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: loginLimit,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      skipSuccessfulRequests: true, // solo cuentan los intentos fallidos
      message: { error: 'Demasiados intentos fallidos. Esperá 15 minutos y volvé a probar.' },
    }),
  );
  app.use('/api/auth', authRouter);
  app.use('/api/public/certificados', publicCertificatesRouter);

  // ---- Privadas ----
  app.use('/api', requireAuth);
  app.use('/api/usuarios', usersRouter);
  app.use(
    '/api/clientes',
    crudRouter(Client, { createSchema: clientInput, searchFields: ['razonSocial', 'cuit'], filters: ['tipo'], sort: 'razonSocial', writeRoles: ['administracion'] }),
  );
  app.use(
    '/api/materiales',
    crudRouter(Material, { createSchema: materialInput, searchFields: ['nombre', 'codigo'], filters: ['categoria'], sort: 'nombre', writeRoles: ['administracion'] }),
  );
  app.use(
    '/api/ingresos',
    crudRouter(Intake, { createSchema: intakeInput, filters: ['origen'], sort: '-fecha', populate: 'items.material', writeRoles: ['operador_planta', 'administracion'] }),
  );
  app.use(
    '/api/ventas',
    crudRouter(Sale, { createSchema: saleInput, filters: ['comprador'], sort: '-fecha', populate: 'comprador items.material', writeRoles: ['administracion'] }),
  );
  app.use('/api/retiros', pickupsRouter);
  app.use('/api/certificados', certificatesRouter);
  app.use('/api/facturas', invoicesRouter);
  app.use('/api/dashboard', dashboardRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
