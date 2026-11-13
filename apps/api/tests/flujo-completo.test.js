import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { User } from '../src/modules/users/user.model.js';

let mongo;
let app;
let token;
const auth = () => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  app = createApp();
  await User.create({ nombre: 'Admin', email: 'admin@test.local', passwordHash: await User.hashPassword('secreto123'), rol: 'admin' });
  const res = await request(app).post('/api/auth/login').send({ email: 'admin@test.local', password: 'secreto123' });
  token = res.body.token;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

describe('Flujo retiro → certificado → factura → cobranza', () => {
  let carton, vidrio, cliente, retiro, cert, factura;

  it('rechaza requests sin token', async () => {
    await request(app).get('/api/clientes').expect(401);
  });

  it('ABM de materiales', async () => {
    carton = (await request(app).post('/api/materiales').set(auth()).send({ codigo: 'cart', nombre: 'Cartón', categoria: 'papel_carton', factorCo2: 0.9 }).expect(201)).body;
    vidrio = (await request(app).post('/api/materiales').set(auth()).send({ codigo: 'VID', nombre: 'Vidrio', categoria: 'vidrio', factorCo2: 0.3, tarifaRetiroKg: 15 }).expect(201)).body;
    expect(carton.codigo).toBe('CART');
    const list = await request(app).get('/api/materiales?q=vid').set(auth()).expect(200);
    expect(list.body.items).toHaveLength(1);
  });

  it('ABM de clientes con validación', async () => {
    await request(app).post('/api/clientes').set(auth()).send({ razonSocial: 'X', cuit: '123' }).expect(400);
    cliente = (
      await request(app)
        .post('/api/clientes')
        .set(auth())
        .send({ razonSocial: 'Hotel Test SRL', cuit: '30-71234567-8', tarifa: { modalidad: 'por_kg', preciosPorKg: [{ material: carton._id, precio: 10 }] } })
        .expect(201)
    ).body;
    expect(cliente.cuit).toBe('30712345678');
    await request(app).patch(`/api/clientes/${cliente._id}`).set(auth()).send({ contacto: { telefono: '5493430000000' } }).expect(200);
  });

  it('registra un retiro de forma idempotente (sync offline)', async () => {
    const body = {
      localId: crypto.randomUUID(),
      cliente: cliente._id,
      items: [{ material: carton._id, pesoEstimadoKg: 100 }, { material: vidrio._id, pesoEstimadoKg: 50 }],
    };
    retiro = (await request(app).post('/api/retiros').set(auth()).send(body).expect(201)).body;
    const again = await request(app).post('/api/retiros').set(auth()).send(body).expect(200);
    expect(again.body._id).toBe(retiro._id);
    expect(retiro.numero).toBe(1);
  });

  it('la planta carga el peso real', async () => {
    await request(app)
      .patch(`/api/retiros/${retiro._id}`)
      .set(auth())
      .send({ estado: 'en_planta', items: [{ material: carton._id, pesoEstimadoKg: 100, pesoRealKg: 110 }, { material: vidrio._id, pesoEstimadoKg: 50, pesoRealKg: 40 }] })
      .expect(200);
  });

  it('emite certificado y se valida públicamente por código', async () => {
    cert = (await request(app).post(`/api/retiros/${retiro._id}/certificado`).set(auth()).expect(201)).body;
    expect(cert.totalKg).toBe(150);
    expect(cert.co2EvitadoKg).toBe(111); // 110*0.9 + 40*0.3

    const pub = await request(app).get(`/api/public/certificados/${cert.codigo}`).expect(200);
    expect(pub.body).toMatchObject({ valido: true, generador: { razonSocial: 'Hotel Test SRL' }, co2EvitadoKg: 111 });
    expect(pub.body.cliente).toBeUndefined();

    const pdf = await request(app).get(`/api/public/certificados/${cert.codigo}/pdf`).buffer(true).expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');

    await request(app).get('/api/public/certificados/no-existe').expect(404);
  });

  it('arma link de WhatsApp para enviar el certificado', async () => {
    const res = await request(app).post(`/api/certificados/${cert._id}/enviar`).set(auth()).send({ canal: 'whatsapp', destino: '+54 9 343 000-0000' }).expect(200);
    expect(res.body.link).toMatch(/^https:\/\/wa\.me\/5493430000000\?text=/);
  });

  it('genera factura por kg usando precio del cliente y default del material', async () => {
    const periodo = { cliente: cliente._id, desde: '2000-01-01', hasta: '2100-01-01' };
    const preview = await request(app).post('/api/facturas/preview').set(auth()).send(periodo).expect(200);
    // 110 kg cartón × $10 (precio cliente) + 40 kg vidrio × $15 (default material)
    expect(preview.body.total).toBe(1700);

    factura = (await request(app).post('/api/facturas').set(auth()).send(periodo).expect(201)).body;
    expect(factura.estado).toBe('pendiente');

    // el retiro ya está facturado: una segunda factura no tiene nada que cobrar
    await request(app).post('/api/facturas').set(auth()).send(periodo).expect(422);
  });

  it('alertas de cobro y registro de pagos', async () => {
    const alertas = await request(app).get('/api/facturas/alertas?dias=30').set(auth()).expect(200);
    expect(alertas.body.porVencer).toHaveLength(1);
    expect(alertas.body.totalPorVencer).toBe(1700);

    await request(app).post(`/api/facturas/${factura._id}/pagos`).set(auth()).send({ monto: 700 }).expect(201);
    const pagada = await request(app).post(`/api/facturas/${factura._id}/pagos`).set(auth()).send({ monto: 1000 }).expect(201);
    expect(pagada.body.estado).toBe('pagada');
    expect(pagada.body.saldo).toBe(0);
  });

  it('dashboard agrega por material y por cliente', async () => {
    const res = await request(app).get('/api/dashboard?desde=2000-01-01&hasta=2100-01-01').set(auth()).expect(200);
    expect(res.body.totales).toMatchObject({ retiros: 1, kgRecuperados: 150, co2EvitadoKg: 111 });
    expect(res.body.porMaterial[0]).toMatchObject({ material: 'Cartón', kg: 110 });
    expect(res.body.porCliente[0]).toMatchObject({ cliente: 'Hotel Test SRL', retiros: 1 });
  });

  it('un chofer no puede crear clientes', async () => {
    await User.create({ nombre: 'Chofer', email: 'chofer@test.local', passwordHash: await User.hashPassword('secreto123'), rol: 'chofer' });
    const login = await request(app).post('/api/auth/login').send({ email: 'chofer@test.local', password: 'secreto123' });
    await request(app).post('/api/clientes').set({ Authorization: `Bearer ${login.body.token}` }).send({ razonSocial: 'Otro' }).expect(403);
  });
});
