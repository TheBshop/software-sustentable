import { Router } from 'express';
import { Organization } from '../organizations/organization.model.js';
import { currentTenant } from '../../lib/tenancy.js';
import { marcoNormativo } from './jurisdicciones.js';

/** Qué hace el sistema para cada tipo de exigencia (`aplica` en jurisdicciones.js). */
export const FUNCIONES = {
  certificado: { nombre: 'Certificado de disposición sustentable', donde: 'Retiros → Emitir certificado' },
  informe_anual: { nombre: 'Informe anual por generador y por sede', donde: 'Portal del cliente → Informe' },
  calidad_separacion: { nombre: 'Calidad de separación por generador', donde: 'Planta y stock' },
  regu: { nombre: 'Corriente REGU separada (pilas, RAEE, neumáticos, aceite)', donde: 'Materiales' },
  peligrosos_bloqueados: { nombre: 'Bloqueo de residuos peligrosos sin inscripción', donde: 'Configuración → Corrientes habilitadas' },
  libro_movimientos: { nombre: 'Libro de movimientos por etapa, exportable', donde: 'Planta y stock → Descargar libro' },
  constancia_reciclado: { nombre: 'Constancia anual de reciclado firmada', donde: 'Clientes → Constancia de reciclado' },
  registro_operador: { nombre: 'Inscripciones impresas en el certificado', donde: 'Configuración → Inscripciones' },
  seguridad_personal: { nombre: 'Registro de EPP y capacitaciones', donde: 'Seguridad e higiene' },
  grandes_generadores: { nombre: 'Datos para el plan del gran generador (kg por fracción, certificados)', donde: 'Portal del cliente' },
  recuperadores: { nombre: 'Ingresos de recuperadores urbanos', donde: 'Planta y stock → Ingresos' },
  tratamiento: { nombre: 'Tratamiento por material (reciclado, compostaje…)', donde: 'Materiales' },
};

export const normativaRouter = Router();

// Marco normativo de la organización según su jurisdicción, con qué cubre el sistema.
normativaRouter.get('/', async (_req, res) => {
  const org = await Organization.findById(currentTenant()).select('nombre jurisdiccion');
  const marco = marcoNormativo(org?.jurisdiccion ?? {});
  const normas = [...marco.nacional, ...marco.provincial, ...marco.municipal];
  const claves = [...new Set(normas.flatMap((n) => n.aplica ?? []))];
  res.json({
    ...marco,
    configurada: Boolean(org?.jurisdiccion?.provincia),
    cobertura: claves.map((k) => ({ clave: k, ...FUNCIONES[k], normas: normas.filter((n) => n.aplica?.includes(k)).map((n) => n.norma) })),
  });
});
