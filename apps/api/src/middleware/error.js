import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function notFound(req, _res, next) {
  next(new HttpError(404, `Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}

// Express 5 propaga automáticamente los errores de handlers async hasta acá.
export function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Datos inválidos', details: err.issues });
  }
  if (err.name === 'CastError') return res.status(400).json({ error: 'ID inválido' });
  if (err.name === 'ValidationError') return res.status(400).json({ error: err.message });
  // Archivo demasiado grande, campo inesperado, etc. (multer)
  if (err.name === 'MulterError') {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'El archivo es demasiado grande' : `Archivo no válido (${err.code})`;
    return res.status(400).json({ error: msg });
  }
  if (err.code === 11000) return res.status(409).json({ error: 'Registro duplicado', details: err.keyValue });

  const status = err.status ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Error interno' : err.message, details: err.details });
}
