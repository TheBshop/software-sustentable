import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';
import { setupSeed } from './helpers.js';
import { enTransaccion } from '../src/lib/transacciones.js';
import { runWithTenant } from '../src/lib/tenancy.js';
import { Client } from '../src/modules/clients/client.model.js';
import { Movimiento } from '../src/modules/movimientos/movimiento.model.js';
import { Material } from '../src/modules/materials/material.model.js';

const app = createApp();
let ctx;
beforeAll(async () => {
  ctx = await setupSeed(app);
});
afterAll(() => ctx.teardown());

describe('Transacciones', () => {
  it('si un paso falla, no queda nada de lo anterior', async () => {
    const coop = ctx.orgs.nv._id;
    await runWithTenant(coop, async () => {
      const antes = await Movimiento.countDocuments();
      await expect(
        enTransaccion(async () => {
          await Client.create({ razonSocial: 'Cliente a medias' });
          await Movimiento.insertMany([{ tipo: 'ajuste', material: (await Material.findOne())._id, kg: 5, etapa: 'tratamiento', motivo: 'prueba' }], { ordered: true });
          throw new Error('falla el tercer paso');
        }),
      ).rejects.toThrow('falla el tercer paso');
      expect(await Client.exists({ razonSocial: 'Cliente a medias' })).toBeNull();
      expect(await Movimiento.countDocuments()).toBe(antes);
    });
  });

  it('si todo sale bien, se guarda todo', async () => {
    await runWithTenant(ctx.orgs.nv._id, async () => {
      await enTransaccion(async () => {
        await Client.create({ razonSocial: 'Cliente completo' });
      });
      expect(await Client.exists({ razonSocial: 'Cliente completo' })).not.toBeNull();
    });
  });
});
