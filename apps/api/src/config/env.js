const DEV_SECRET = 'dev-secret-cambiar';

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  mongoUri: process.env.MONGO_URI ?? 'mongodb://localhost:27017/nueva-vida',
  jwtSecret: process.env.JWT_SECRET ?? DEV_SECRET,
  publicWebUrl: process.env.PUBLIC_WEB_URL ?? 'http://localhost:5173',
  uploadsDir: process.env.UPLOADS_DIR ?? 'uploads',
  smtp: {
    host: process.env.SMTP_HOST || null,
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM ?? 'Cooperativa Nueva Vida <no-reply@example.org>',
  },
};

if (env.nodeEnv === 'production' && env.jwtSecret === DEV_SECRET) {
  throw new Error('JWT_SECRET es obligatorio en producción');
}
