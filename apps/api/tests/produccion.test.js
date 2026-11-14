import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { createApp } from '../src/app.js';
import { checkProductionEnv, env } from '../src/config/env.js';
import { s3Driver } from '../src/lib/storage.js';
import { User } from '../src/modules/users/user.model.js';
import { Client } from '../src/modules/clients/client.model.js';
import { Material } from '../src/modules/materials/material.model.js';
import { Organization } from '../src/modules/organizations/organization.model.js';
import { runWithTenant } from '../src/lib/tenancy.js';

// PNG de 1×1 px
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

let mongo;
const tokens = {};
let retiro;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const app = createApp();
  const coop = await Organization.create({ tipo: 'cooperativa', nombre: 'Coop Fotos', cuit: '30700000098' });
  for (const [rol, email] of [['chofer', 'c1@test.local'], ['chofer', 'c2@test.local']]) {
    await User.create({ nombre: email, email, rol, organizacion: coop._id, passwordHash: await User.hashPassword('secreto123') });
    tokens[email] = (await request(app).post('/api/auth/login').send({ email, password: 'secreto123' })).body.token;
  }
  const [cliente, material] = await runWithTenant(coop._id, async () => [
    await Client.create({ razonSocial: 'Cliente Fotos' }),
    await Material.create({ codigo: 'CART', nombre: 'Cartón', categoria: 'papel_carton' }),
  ]);
  retiro = (
    await request(app)
      .post('/api/retiros')
      .set('Authorization', `Bearer ${tokens['c1@test.local']}`)
      .send({ cliente: cliente.id, items: [{ material: material.id, pesoEstimadoKg: 10 }] })
  ).body;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

describe('Fotos de retiros', () => {
  const app = createApp();

  it('guarda la foto y la sirve (almacenamiento local)', async () => {
    const res = await request(app)
      .post(`/api/retiros/${retiro._id}/fotos`)
      .set('Authorization', `Bearer ${tokens['c1@test.local']}`)
      .attach('fotos', PNG, { filename: 'foto.png', contentType: 'image/png' })
      .expect(201);
    const url = res.body.fotos[0].url;
    expect(url).toMatch(/^\/uploads\/retiros\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/);
    const img = await request(app).get(url).expect(200);
    expect(img.headers['content-type']).toBe('image/png');
  });

  it('rechaza archivos que no son imágenes', async () => {
    await request(app)
      .post(`/api/retiros/${retiro._id}/fotos`)
      .set('Authorization', `Bearer ${tokens['c1@test.local']}`)
      .attach('fotos', Buffer.from('hola'), { filename: 'nota.txt', contentType: 'text/plain' })
      .expect(400);
  });

  it('un chofer no puede subir fotos al retiro de otro', async () => {
    await request(app)
      .post(`/api/retiros/${retiro._id}/fotos`)
      .set('Authorization', `Bearer ${tokens['c2@test.local']}`)
      .attach('fotos', PNG, { filename: 'foto.png', contentType: 'image/png' })
      .expect(403);
  });

  it('el driver S3/R2 sube con la clave, el tipo y la URL pública correctos', async () => {
    const sent = [];
    const driver = s3Driver({ bucket: 'fotos-coope', publicUrl: 'https://fotos.example.org/' }, { send: async (cmd) => sent.push(cmd) });
    const url = await driver.save(PNG, { prefix: 'retiros', mimetype: 'image/jpeg' });
    expect(sent[0]).toBeInstanceOf(PutObjectCommand);
    expect(sent[0].input).toMatchObject({ Bucket: 'fotos-coope', ContentType: 'image/jpeg', Body: PNG });
    expect(url).toBe(`https://fotos.example.org/${sent[0].input.Key}`);
    expect(sent[0].input.Key).toMatch(/^retiros\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.jpg$/);
  });
});

describe('Seguridad para producción', () => {
  it('CORS: solo los orígenes configurados; la app móvil (sin Origin) siempre pasa', async () => {
    const app = createApp({ corsOrigins: ['https://panel.coope.example'] });
    const ok = await request(app).get('/health').set('Origin', 'https://panel.coope.example');
    expect(ok.headers['access-control-allow-origin']).toBe('https://panel.coope.example');
    const otro = await request(app).get('/health').set('Origin', 'https://malicioso.example');
    expect(otro.headers['access-control-allow-origin']).toBeUndefined();
    await request(app).get('/health').expect(200); // sin Origin
  });

  it('limita los intentos de login fallidos por IP', async () => {
    const app = createApp({ loginRateLimit: 2 });
    const mal = { email: 'c1@test.local', password: 'incorrecta' };
    await request(app).post('/api/auth/login').send(mal).expect(401);
    await request(app).post('/api/auth/login').send(mal).expect(401);
    const bloqueado = await request(app).post('/api/auth/login').send(mal).expect(429);
    expect(bloqueado.body.error).toContain('15 minutos');
  });

  it('los logins correctos no cuentan para el límite', async () => {
    const app = createApp({ loginRateLimit: 1 });
    for (let i = 0; i < 3; i++) await request(app).post('/api/auth/login').send({ email: 'c1@test.local', password: 'secreto123' }).expect(200);
  });

  it('detecta configuración faltante para producción', () => {
    expect(checkProductionEnv(env, {})).toEqual(
      expect.arrayContaining(['MONGO_URI', 'JWT_SECRET (32+ caracteres)', 'PUBLIC_WEB_URL', 'CORS_ORIGINS', 'STORAGE_DRIVER=s3 (el disco de Render no es persistente)']),
    );
    const completo = {
      ...env,
      corsOrigins: ['https://panel.example'],
      storage: { driver: 's3', s3: { bucket: 'b', accessKeyId: 'k', secretAccessKey: 's', publicUrl: 'https://f.example' } },
    };
    expect(checkProductionEnv(completo, { MONGO_URI: 'mongodb+srv://x', JWT_SECRET: 'x'.repeat(40), PUBLIC_WEB_URL: 'https://panel.example' })).toEqual([]);
  });
});

describe('Caché', () => {
  it('las respuestas de la API no se guardan en caché', async () => {
    const res = await request(createApp()).get('/api/public/certificados/no-existe');
    expect(res.headers['cache-control']).toBe('no-store');
  });
});
