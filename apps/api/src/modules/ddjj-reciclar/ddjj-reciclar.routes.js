import { Router } from 'express';
import { generarDDJJReciclar } from './ddjj-reciclar.service.js';

export const ddjjReciclarRouter = Router();

ddjjReciclarRouter.get('/', async (req, res, next) => {
  try {
    const anio = Number(req.query.anio) || new Date().getFullYear();
    const mes = Number(req.query.mes) || new Date().getMonth() + 1;
    const data = await generarDDJJReciclar({ anio, mes });
    res.json(data);
  } catch (err) {
    next(err);
  }
});
