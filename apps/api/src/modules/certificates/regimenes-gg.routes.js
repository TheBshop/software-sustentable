import { Router } from 'express';
import { REGIMENES_GG, CODIGOS_VALORIZACION } from './regimenes-gg.js';

export const regimenesGGRouter = Router();

regimenesGGRouter.get('/', (_req, res) => {
  const items = Object.entries(REGIMENES_GG).map(([clave, r]) => ({
    clave,
    nombre: r.nombre,
    normaGG: r.normaGG,
    definicion: r.definicion,
    camposGenerador: r.camposGenerador,
    camposCertificado: r.camposCertificado,
    periodoMinimo: r.periodoMinimo,
    firmaResponsableTecnico: r.firmaResponsableTecnico,
    verificado: r.verificado,
  }));
  res.json({ items, codigosValorizacion: CODIGOS_VALORIZACION });
});
