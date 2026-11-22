import { Router } from 'express';

export const snigeiPublicoRouter = Router();

// Caso de ejemplo SNIGEI estático — no requiere auth.
// Simula un reporte mensual tipo SNIGEI para que la landing lo muestre como demo navegable.
snigeiPublicoRouter.get('/caso-ejemplo', (_req, res) => {
  res.json({
    periodo: { anio: 2025, mes: 10, label: 'Octubre 2025' },
    organizacion: 'Cooperativa Ejemplo Verde',
    totales: {
      ingresoKg: 48720,
      ingresoTn: 48.72,
      ventaKg: 41200,
      disposicionFinalKg: 7520,
      recuperadoKg: 41200,
      tasaRecuperacionPct: 84.6,
    },
    porCorriente: [
      { corriente: 'Y48 – Residuos domiciliarios', kg: 32000 },
      { corriente: 'Y18 – Residuos industriales no peligrosos', kg: 16720 },
    ],
    porFraccion: [
      { fraccion: 'Papel y cartón', kg: 18400 },
      { fraccion: 'Plásticos', kg: 12800 },
      { fraccion: 'Vidrio', kg: 6300 },
      { fraccion: 'Metales', kg: 4500 },
      { fraccion: 'Otros recuperables', kg: 6720 },
    ],
    porTratamiento: [
      { tratamiento: 'Clasificación y enfardado', kg: 41200 },
      { tratamiento: 'Disposición final', kg: 7520 },
    ],
  });
});
