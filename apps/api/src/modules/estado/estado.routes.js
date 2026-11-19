// Estado del sistema: versión, uptime, último backup conocido.
import { Router } from 'express';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import mongoose from 'mongoose';
import { env } from '../../config/env.js';

const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '../../../package.json');
let version = '0.0.0';
try { version = JSON.parse(readFileSync(pkgPath, 'utf8')).version; } catch {}

export const estadoRouter = Router();

estadoRouter.get('/', (_req, res) => {
  res.json({
    version,
    env: env.nodeEnv,
    mongo: mongoose.connection?.readyState === 1 ? 'conectado' : 'desconectado',
    uptimeSegundos: Math.round(process.uptime()),
    storage: env.storage.driver,
    emailConfigurado: !!env.smtp.host,
    hora: new Date().toISOString(),
  });
});
