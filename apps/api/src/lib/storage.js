// Almacenamiento de archivos (fotos de los retiros).
//
//   STORAGE_DRIVER=local  → disco del servidor, servido en /uploads (solo desarrollo:
//                           Render y Railway borran el disco en cada deploy)
//   STORAGE_DRIVER=s3     → cualquier servicio compatible con S3: Cloudflare R2 (recomendado,
//                           sin costo de salida), AWS S3, Backblaze B2, MinIO
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../config/env.js';

const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/heic': '.heic' };

/** Nombre único y ordenado por fecha: retiros/2026/11/<uuid>.jpg */
function makeKey(prefix, mimetype) {
  const d = new Date();
  return `${prefix}/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}${EXT[mimetype] ?? '.jpg'}`;
}

function localDriver(dir) {
  return {
    async save(buffer, { prefix, mimetype }) {
      const key = makeKey(prefix, mimetype);
      const file = path.join(dir, key);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, buffer);
      return `/uploads/${key}`; // relativa a la API; la web le antepone la URL de la API
    },
  };
}

/** `client` se puede inyectar (tests); si no, se arma con las credenciales del entorno. */
export function s3Driver(cfg, client) {
  const s3 =
    client ??
    new S3Client({
      region: cfg.region,
      endpoint: cfg.endpoint || undefined,
      forcePathStyle: Boolean(cfg.endpoint), // R2/MinIO
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    });
  return {
    async save(buffer, { prefix, mimetype }) {
      const key = makeKey(prefix, mimetype);
      await s3.send(
        new PutObjectCommand({
          Bucket: cfg.bucket,
          Key: key,
          Body: buffer,
          ContentType: mimetype,
          CacheControl: 'public, max-age=31536000, immutable', // el nombre nunca se reutiliza
        }),
      );
      return `${cfg.publicUrl.replace(/\/$/, '')}/${key}`;
    },
  };
}

export const storage = env.storage.driver === 's3' ? s3Driver(env.storage.s3) : localDriver(env.uploadsDir);

/** Devuelve el contenido de un archivo guardado con `storage.save` (para insertarlo en un PDF). */
export async function leerArchivo(url) {
  if (url.startsWith('/uploads/')) return fs.readFile(path.join(env.uploadsDir, url.slice('/uploads/'.length)));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo leer ${url}`);
  return Buffer.from(await res.arrayBuffer());
}
