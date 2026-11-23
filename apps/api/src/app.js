import express, { Router } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import mongooseLib from 'mongoose';
import { env } from './config/env.js';
import { requireAuth, requireOperador, requireRole } from './middleware/auth.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { auditoriaRouter } from './modules/admin/auditoria.routes.js';
import { registrosRouter } from './modules/registros/registro.routes.js';
import { panelRouter } from './modules/panel/panel.routes.js';
import { procesoRouter, lotesRouter, remitosRouter, calidadRouter } from './modules/proceso/proceso.routes.js';
import { rutinasRouter } from './modules/proceso/rutinas.js';
import { tratamientosRouter } from './modules/tratamientos/tratamientos.js';
import { comercialRouter, contratosRouter, conveniosRouter, ingresosCajaRouter } from './modules/comercial/comercial.routes.js';
import { cumplimientoRouter } from './modules/cumplimiento/cumplimiento.routes.js';
import { resultadosRouter } from './modules/resultados/resultados.routes.js';
import { afipRouter } from './modules/afip/afip.routes.js';
import { manifiestosRouter, manifiestosPublicosRouter } from './modules/manifiestos/manifiestos.routes.js';
import { importOdooRouter } from './modules/import-odoo/import-odoo.routes.js';
import { presupuestosRouter } from './modules/presupuestos/presupuestos.routes.js';
import { snigeiRouter } from './modules/snigei/snigei.routes.js';
import { consumosRouter } from './modules/consumos/consumos.routes.js';
import { exportarRouter } from './modules/exportar/exportar.routes.js';
import { miOrganizacionRouter } from './modules/organizations/mi-organizacion.routes.js';
import { estadoRouter } from './modules/estado/estado.routes.js';
import { withTenant, runWithoutTenant } from './lib/tenancy.js';
import { errorHandler, notFound } from './middleware/error.js';
import { crudRouter } from './lib/crud.js';
import { authRouter, usersRouter } from './modules/users/auth.routes.js';
import { Client, clientInput } from './modules/clients/client.model.js';
import { Material, materialInput, materialUpdate } from './modules/materials/material.model.js';
import { Intake, intakeInput, intakeUpdate, Sale, saleInput, saleUpdate } from './modules/plant/plant.models.js';
import { plantaRouter } from './modules/movimientos/planta.routes.js';
import { portalRouter } from './modules/portal/portal.routes.js';
import { resolverPesos } from './modules/materials/unidades.js';
import { anotarReferencias, avisosPrecio, ventasResumenRouter } from './modules/plant/ventas.service.js';
import { Gasto, gastoInput } from './modules/finanzas/gasto.model.js';
import { balanceRouter } from './modules/finanzas/balance.routes.js';
import { RegistroSeguridad, registroInput, registroUpdate, seguridadResumenRouter } from './modules/seguridad/seguridad.js';
import { accesoPortalRouter } from './modules/clients/acceso.routes.js';
import { constanciaRouter } from './modules/certificates/constancia.js';
import { regimenesGGRouter } from './modules/certificates/regimenes-gg.routes.js';
import { normativaRouter } from './modules/normativa/normativa.routes.js';
import { clasificadorRouter } from './modules/normativa/clasificador.js';
import { productividadRouter } from './modules/productividad/productividad.routes.js';
import { solicitudesRouter, hojaDeRutaRouter, logisticaRouter } from './modules/logistica/logistica.routes.js';
import { Recuperador, recuperadorInput, comprasRouter, recuperadoresResumenRouter } from './modules/recuperadores/recuperadores.js';
import { obligacionesRouter } from './modules/obligaciones/obligaciones.routes.js';
import { ddjjReciclarRouter } from './modules/ddjj-reciclar/ddjj-reciclar.routes.js';
import { snigeiPublicoRouter } from './modules/snigei/snigei-publico.routes.js';
import { demoRouter } from './demo/demo.routes.js';
import { assertHabilitados, assertCorrienteHabilitada, registrarIngreso, registrarVenta } from './modules/movimientos/movimiento.service.js';
import { pickupsRouter } from './modules/pickups/pickup.routes.js';
import { certificatesRouter, publicCertificatesRouter } from './modules/certificates/certificate.routes.js';
import { invoicesRouter } from './modules/invoices/invoice.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';

/** `config` permite a los tests cambiar orígenes CORS o el límite de login sin tocar el entorno. */
export function createApp(config = {}) {
  const corsOrigins = config.corsOrigins ?? env.corsOrigins;
  const loginLimit = config.loginRateLimit ?? env.loginRateLimit;

  const app = express();
  app.set('trust proxy', 1); // Render/Railway/Fly ponen un proxy adelante: la IP real viene en X-Forwarded-For
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      // Sin lista configurada (desarrollo) se acepta cualquier origen. La app móvil no envía Origin.
      origin: (origin, cb) => cb(null, !corsOrigins.length || !origin || corsOrigins.includes(origin)),
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  if (env.nodeEnv !== 'test') app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

  // Request id para correlacionar logs. Si el proxy manda X-Request-Id, lo respeta.
  app.use((req, res, next) => {
    const id = req.headers['x-request-id'] || Math.random().toString(36).slice(2, 10);
    req.id = id;
    res.setHeader('X-Request-Id', id);
    next();
  });

  // Health del sistema: Mongo responde? versión y uptime.
  app.get(['/health', '/api/health'], (_req, res) => {
    const estado = mongooseLib.connection?.readyState === 1 ? 'conectado' : 'desconectado';
    res.json({ ok: true, mongo: estado, uptime: Math.round(process.uptime()), env: env.nodeEnv });
  });

  // Rate limit global suave a /api (además del específico de login). Se desactiva en tests.
  if (env.nodeEnv !== 'test') {
    app.use('/api', rateLimit({
      windowMs: 60 * 1000,
      limit: Number(process.env.API_RATE_LIMIT ?? 240), // 4/seg por IP por defecto
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { error: 'Demasiadas solicitudes. Reintentá en un minuto.' },
    }));
  }

  // Datos privados: que ni el navegador ni proxies intermedios guarden respuestas de la API
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  if (env.storage.driver === 'local') app.use('/uploads', express.static(env.uploadsDir));

  // ---- Públicas ----
  app.use(
    '/api/auth/login',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: loginLimit,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      skipSuccessfulRequests: true, // solo cuentan los intentos fallidos
      message: { error: 'Demasiados intentos fallidos. Esperá 15 minutos y volvé a probar.' },
    }),
  );
  app.use('/api/auth', authRouter);
  app.use('/api/public/certificados', publicCertificatesRouter);
  // Recepción pública de manifiestos (QR del PDF → firma + geolocalización)
  app.use('/api/public/manifiestos', (_req, _res, next) => runWithoutTenant(next), manifiestosPublicosRouter);
  app.use('/api/public/snigei', snigeiPublicoRouter);
  if (env.demoMode) app.use('/api/demo', (_req, _res, next) => runWithoutTenant(next), demoRouter);

  // ---- Privadas ----
  // requireAuth identifica al usuario; withTenant fija su cooperativa para todo el request
  // (lib/tenancy.js filtra cada consulta por esa cooperativa).
  app.use('/api', requireAuth, withTenant);
  app.use('/api/usuarios', usersRouter);
  // Administración de la plataforma (alta de organizaciones y usuarios)
  app.use('/api/admin', adminRouter);
  // Portal de clientes generadores (empresas y municipios). Versionado: lo pueden consumir terceros.
  app.use('/api/v1/portal', portalRouter);

  // Zona de gestión: organizaciones operadoras (cooperativa, recicladora o municipio).
  // Los generadores usan el portal.
  const coopApi = Router();
  coopApi.use(requireOperador());
  app.use('/api', coopApi);
  coopApi.use('/auditoria', requireRole('admin'), auditoriaRouter); // quién cargó qué
  coopApi.use('/panel', panelRouter); // inicio: indicadores, avisos y primeros pasos según el perfil
  coopApi.use('/registros', registrosRouter); // registros por perfil (catálogo REG)
  // Proceso de planta: mapa, lotes (recepción → clasificado → enfardado → vendido), remitos, rutinas y calidad
  coopApi.use('/proceso', procesoRouter);
  coopApi.use('/lotes', lotesRouter);
  coopApi.use('/remitos', remitosRouter);
  coopApi.use('/rutinas', rutinasRouter);
  coopApi.use('/calidad', calidadRouter);
  coopApi.use('/tratamientos', tratamientosRouter); // partidas y parámetros por corriente de tratamiento
  // Comercial: stock y margen, padrón, contratos de venta, convenio con el municipio, ingresos de caja
  coopApi.use('/comercial', comercialRouter);
  coopApi.use('/contratos', contratosRouter);
  coopApi.use('/convenios', conveniosRouter);
  coopApi.use('/ingresos-caja', requireRole('administracion'), ingresosCajaRouter);
  // Cumplimiento: matriz, evidencias (archivo y vencimiento), autodiagnóstico
  coopApi.use('/cumplimiento', cumplimientoRouter);
  // Resultados: huella, emisiones evitadas, informe por cliente, memoria anual
  coopApi.use('/resultados', resultadosRouter);
  coopApi.use('/afip', afipRouter); // facturación electrónica AFIP (modo mock por defecto)
  coopApi.use('/manifiestos', manifiestosRouter); // manifiestos de traslado con recepción por QR
  coopApi.use('/import/odoo', importOdooRouter); // importador de CSVs exportados desde Odoo
  coopApi.use('/presupuestos', presupuestosRouter); // presupuestos (cotizaciones) previos a factura
  coopApi.use('/snigei', snigeiRouter); // reporte mensual tipo SNIGEI (toneladas por corriente/tratamiento)
  coopApi.use('/obligaciones', obligacionesRouter); // panel de obligaciones con semáforos
  coopApi.use('/ddjj-reciclar', ddjjReciclarRouter); // DDJJ RG 2849 comercializadores de materiales a reciclar
  coopApi.use('/consumos', consumosRouter); // servicios, combustible y huella de carbono
  coopApi.use('/mi-organizacion/exportar', exportarRouter); // export ZIP de todos los datos (Ley 25.326)
  coopApi.use('/mi-organizacion', miOrganizacionRouter); // datos fiscales y edición de la propia org
  coopApi.use('/estado', estadoRouter); // versión, uptime, storage, email
  coopApi.use('/clientes', accesoPortalRouter);
  coopApi.use('/clientes', constanciaRouter); // constancia anual de reciclado (Ley 25.612)
  coopApi.use('/regimenes-gg', regimenesGGRouter); // jurisdicciones y campos para grandes generadores
  coopApi.use('/normativa', normativaRouter); // marco normativo según la jurisdicción
  coopApi.use('/clasificador', clasificadorRouter); // clasificación de residuos en los tres niveles
  coopApi.use('/productividad', productividadRouter); // indicadores de la guía de productividad de plantas
  coopApi.use('/solicitudes', solicitudesRouter); // pedidos de retiro
  coopApi.use('/hoja-de-ruta', hojaDeRutaRouter); // paradas del día, en orden sugerido
  coopApi.use('/logistica', logisticaRouter); // indicadores de los recorridos
  // Recuperadores urbanos (registro) y compras de material con recibo
  coopApi.use('/recuperadores', recuperadoresResumenRouter);
  coopApi.use('/recuperadores', requireRole('administracion', 'operador_planta'), crudRouter(Recuperador, { createSchema: recuperadorInput, searchFields: ['nombre', 'zona'], sort: 'nombre', writeRoles: ['administracion', 'operador_planta'] }));
  coopApi.use('/compras', comprasRouter);
  coopApi.use(
    '/clientes',
    crudRouter(Client, { createSchema: clientInput, searchFields: ['razonSocial', 'cuit'], filters: ['tipo'], sort: 'razonSocial', writeRoles: ['administracion'] }),
  );
  coopApi.use(
    '/materiales',
    crudRouter(Material, { createSchema: materialInput, updateSchema: materialUpdate, beforeCreate: (d) => assertCorrienteHabilitada(d.corriente), searchFields: ['nombre', 'codigo'], filters: ['categoria'], sort: 'nombre', writeRoles: ['administracion'] }),
  );
  coopApi.use(
    '/ingresos',
    crudRouter(Intake, {
      createSchema: intakeInput,
      updateSchema: intakeUpdate,
      beforeCreate: async (d) => {
        await assertHabilitados(d.items.map((i) => i.material));
        d.items = await resolverPesos(d.items, 'pesoKg'); // sin balanza: fardos, bolsones, camiones
      },
      afterCreate: (doc, req) => registrarIngreso(doc, req.user.sub),
      allowDelete: false,
      filters: ['origen'],
      sort: '-fecha',
      populate: 'items.material',
      writeRoles: ['operador_planta', 'administracion'],
    }),
  );
  coopApi.use('/ventas', ventasResumenRouter);
  coopApi.use(
    '/ventas',
    crudRouter(Sale, {
      createSchema: saleInput,
      updateSchema: saleUpdate,
      beforeCreate: async (d) => {
        await assertHabilitados(d.items.map((i) => i.material));
        await anotarReferencias(d); // precio de mercado del momento
      },
      afterCreate: async (doc, req) => {
        await registrarVenta(doc, req.user.sub);
        return { avisos: await avisosPrecio(doc) };
      },
      allowDelete: false,
      filters: ['comprador'],
      sort: '-fecha',
      populate: 'comprador items.material',
      writeRoles: ['administracion'],
    }),
  );
  coopApi.use('/retiros', pickupsRouter);
  coopApi.use('/certificados', certificatesRouter);
  coopApi.use('/facturas', invoicesRouter);
  coopApi.use('/dashboard', dashboardRouter);
  coopApi.use('/planta', plantaRouter);
  coopApi.use('/gastos', requireRole('administracion'), crudRouter(Gasto, { createSchema: gastoInput, filters: ['categoria'], sort: '-fecha', writeRoles: ['administracion'] }));
  coopApi.use('/balance', requireRole('administracion'), balanceRouter);
  // Seguridad e higiene del personal (Ord. 9233 de Paraná, art. 21)
  coopApi.use('/seguridad', requireRole('administracion'), seguridadResumenRouter);
  coopApi.use('/seguridad', requireRole('administracion'), crudRouter(RegistroSeguridad, { createSchema: registroInput, updateSchema: registroUpdate, filters: ['tipo', 'persona'], sort: '-fecha', writeRoles: ['administracion'] }));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
