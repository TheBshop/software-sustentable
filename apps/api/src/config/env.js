const DEV_SECRET = 'dev-secret-cambiar';
const nodeEnv = process.env.NODE_ENV ?? 'development';
const list = (v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

export const env = {
  nodeEnv,
  port: Number(process.env.PORT ?? 4000),
  mongoUri: process.env.MONGO_URI ?? 'mongodb://localhost:27017/nueva-vida',
  jwtSecret: process.env.JWT_SECRET ?? DEV_SECRET,
  publicWebUrl: process.env.PUBLIC_WEB_URL ?? 'http://localhost:5173',
  // Orígenes web que pueden llamar a la API (la app móvil no envía Origin y siempre pasa).
  // Vacío = cualquiera (solo desarrollo).
  corsOrigins: list(process.env.CORS_ORIGINS),
  uploadsDir: process.env.UPLOADS_DIR ?? 'uploads',
  storage: {
    driver: process.env.STORAGE_DRIVER ?? 'local',
    s3: {
      endpoint: process.env.S3_ENDPOINT, // R2: https://<account-id>.r2.cloudflarestorage.com
      region: process.env.S3_REGION ?? 'auto',
      bucket: process.env.S3_BUCKET,
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      publicUrl: process.env.STORAGE_PUBLIC_URL, // R2: dominio público del bucket
    },
  },
  loginRateLimit: Number(process.env.LOGIN_RATE_LIMIT ?? 10), // intentos por IP cada 15 minutos
  smtp: {
    host: process.env.SMTP_HOST || null,
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM ?? 'Cooperativa Nueva Vida <no-reply@example.org>',
  },
};

/** En producción, falla al arrancar si falta configuración en vez de fallar con el primer usuario. */
export function checkProductionEnv(e = env, raw = process.env) {
  const faltan = [];
  if (!raw.MONGO_URI) faltan.push('MONGO_URI');
  if (!raw.JWT_SECRET || raw.JWT_SECRET === DEV_SECRET || raw.JWT_SECRET.length < 32) faltan.push('JWT_SECRET (32+ caracteres)');
  if (!raw.PUBLIC_WEB_URL) faltan.push('PUBLIC_WEB_URL');
  if (!e.corsOrigins.length) faltan.push('CORS_ORIGINS');
  if (e.storage.driver !== 's3') faltan.push('STORAGE_DRIVER=s3 (el disco de Render no es persistente)');
  else {
    for (const [k, v] of Object.entries({ S3_BUCKET: 'bucket', S3_ACCESS_KEY_ID: 'accessKeyId', S3_SECRET_ACCESS_KEY: 'secretAccessKey', STORAGE_PUBLIC_URL: 'publicUrl' })) {
      if (!e.storage.s3[v]) faltan.push(k);
    }
  }
  return faltan;
}

if (nodeEnv === 'production') {
  const faltan = checkProductionEnv();
  if (faltan.length) throw new Error(`Faltan variables de entorno para producción: ${faltan.join(', ')}`);
}
