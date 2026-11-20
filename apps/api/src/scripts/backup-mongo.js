// Backup diario de Mongo a S3/R2. Se corre como cron de Render/Fly.
//   npm run backup   (lee MONGO_URI y S3_* del entorno)
import mongoose from 'mongoose';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { env, checkProductionEnv } from '../config/env.js';
import { gzipSync } from 'node:zlib';

// El cron solo necesita Mongo y S3; no requiere JWT ni URLs web.
if (env.nodeEnv === 'production') {
  const faltan = checkProductionEnv('worker');
  if (faltan.length) {
    console.error(`backup-mongo: faltan variables: ${faltan.join(', ')}`);
    process.exit(1);
  }
}
if (env.storage.driver !== 's3') {
  console.error('backup-mongo: STORAGE_DRIVER debe ser s3 (bucket destino).');
  process.exit(1);
}

await mongoose.connect(env.mongoUri);
try {
  const db = mongoose.connection.db;
  const cols = await db.listCollections().toArray();
  const snapshot = {};
  for (const { name } of cols) {
    snapshot[name] = await db.collection(name).find({}).toArray();
  }
  const fecha = new Date().toISOString().slice(0, 10);
  const key = `backups/mongo-${fecha}.json.gz`;
  const body = gzipSync(Buffer.from(JSON.stringify(snapshot)));
  const s3 = new S3Client({
    region: env.storage.s3.region,
    endpoint: env.storage.s3.endpoint,
    credentials: { accessKeyId: env.storage.s3.accessKeyId, secretAccessKey: env.storage.s3.secretAccessKey },
  });
  await s3.send(new PutObjectCommand({ Bucket: env.storage.s3.bucket, Key: key, Body: body, ContentType: 'application/gzip' }));
  console.log(`✓ Backup subido: s3://${env.storage.s3.bucket}/${key} (${(body.length / 1024).toFixed(1)} KB)`);
} catch (err) {
  console.error('✗ Error en backup:', err.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
