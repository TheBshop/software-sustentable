// Las 5 secciones de la plataforma y sus pestañas. Cada pestaña puede limitarse a perfiles
// (cooperativa, empresa = recicladora, municipio) y a roles de usuario.
const GESTIONA = ['admin', 'administracion', 'operador_planta'];
const ADMINISTRA = ['admin', 'administracion'];
const PLANTA = ['cooperativa', 'empresa'];

export const PERFILES = {
  cooperativa: 'Cooperativa',
  empresa: 'Empresa recicladora',
  municipio: 'Municipio',
};
/** Perfil según el tipo de organización operadora (mismo criterio que la API). */
export const perfilDe = (tipo) => ({ cooperativa: 'cooperativa', recicladora: 'empresa', municipio: 'municipio' })[tipo] ?? 'cooperativa';

export const SECCIONES = [
  {
    id: 'inicio',
    label: 'Inicio',
    icono: 'inicio',
    tabs: [
      { to: '/', label: 'Panel', end: true },
      { to: '/inicio/pasos', label: 'Cómo empezar' },
    ],
  },
  {
    id: 'operacion',
    label: 'Operación',
    icono: 'operacion',
    tabs: [
      { to: '/operacion/proceso', label: 'Proceso', perfiles: PLANTA },
      { to: '/operacion/registros', label: 'Registros' },
      { to: '/operacion/agenda', label: 'Agenda de retiros', perfiles: PLANTA, roles: GESTIONA },
      { to: '/operacion/retiros', label: 'Retiros', perfiles: PLANTA },
      { to: '/operacion/planta', label: 'Ingresos y stock', perfiles: PLANTA },
      { to: '/operacion/rutinas', label: 'Rutinas', perfiles: PLANTA },
      { to: '/operacion/tratamientos', label: 'Tratamientos' },
      { to: '/operacion/manifiestos', label: 'Manifiestos', perfiles: PLANTA },
      { to: '/operacion/recuperadores', label: 'Recuperadores', perfiles: PLANTA, roles: GESTIONA },
      { to: '/operacion/productividad', label: 'Productividad', perfiles: PLANTA, roles: GESTIONA },
      { to: '/operacion/seguridad', label: 'Seguridad e higiene', roles: ADMINISTRA },
    ],
  },
  {
    id: 'comercial',
    label: 'Comercial',
    icono: 'comercial',
    tabs: [
      { to: '/comercial/ventas', label: 'Ventas', perfiles: PLANTA },
      { to: '/comercial/compras', label: 'Compras', perfiles: PLANTA, roles: GESTIONA },
      { to: '/comercial/stock', label: 'Stock y margen', perfiles: PLANTA },
      { to: '/comercial/contratos', label: 'Contratos', perfiles: PLANTA },
      { to: '/comercial/remitos', label: 'Remitos', perfiles: PLANTA },
      { to: '/comercial/convenio', label: 'Convenio con el municipio', perfiles: ['cooperativa'] },
      { to: '/comercial/clientes', label: 'Clientes y proveedores', perfiles: PLANTA },
      { to: '/comercial/materiales', label: 'Materiales y precios', perfiles: PLANTA },
      { to: '/comercial/facturacion', label: 'Facturación', perfiles: PLANTA },
      { to: '/comercial/afip', label: 'AFIP', perfiles: PLANTA, roles: ADMINISTRA },
      { to: '/comercial/contabilidad', label: 'Contabilidad', perfiles: PLANTA, roles: ADMINISTRA },
      { to: '/comercial/importar-odoo', label: 'Importar Odoo', perfiles: PLANTA, roles: ADMINISTRA },
      { to: '/comercial/balance', label: 'Balance', perfiles: PLANTA, roles: ADMINISTRA },
    ],
  },
  {
    id: 'resultados',
    label: 'Métricas',
    icono: 'resultados',
    tabs: [
      { to: '/resultados', label: 'Indicadores', perfiles: PLANTA, end: true },
      { to: '/resultados/sustentabilidad', label: 'Sustentabilidad y memoria', perfiles: PLANTA },
    ],
  },
  {
    id: 'cumplimiento',
    label: 'Cumplimiento',
    icono: 'cumplimiento',
    tabs: [
      { to: '/cumplimiento', label: 'Matriz', end: true, perfiles: PLANTA },
      { to: '/cumplimiento/autodiagnostico', label: 'Autodiagnóstico', perfiles: PLANTA },
      { to: '/cumplimiento/normativa', label: 'Normativa' },
      { to: '/cumplimiento/certificados', label: 'Certificados', perfiles: PLANTA },
      { to: '/cumplimiento/clasificar', label: 'Clasificar residuos' },
    ],
  },
];

const permitida = (tab, perfil, rol) => (!tab.perfiles || tab.perfiles.includes(perfil)) && (!tab.roles || rol === 'admin' || tab.roles.includes(rol));

/** Secciones visibles para el perfil y el rol, con sus pestañas filtradas (sin secciones vacías). */
export const seccionesPara = (perfil, rol) =>
  SECCIONES.map((s) => ({ ...s, tabs: s.tabs.filter((t) => permitida(t, perfil, rol)) })).filter((s) => s.tabs.length);

/** Sección y pestaña de una ruta. */
export function ubicar(secciones, pathname) {
  for (const s of secciones) {
    const tab = s.tabs.find((t) => (t.end ? pathname === t.to : pathname === t.to || pathname.startsWith(`${t.to}/`)));
    if (tab) return { seccion: s, tab };
  }
  return { seccion: null, tab: null };
}
