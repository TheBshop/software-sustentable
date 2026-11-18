// Catálogos de operación: pesaje sin báscula, controles, rutinas, convenio y caja.
// Generado desde la página (nueva-vida-propuesta.html). Fuente única de estos datos para la API y la web.


export const UNIDADES = { Fardo: 250, Bolsón: 50, Bolsa: 8, Jaula: 150 };

export const PLURAL = { Fardo: 'fardos', Bolsón: 'bolsones', Bolsa: 'bolsas', Jaula: 'jaulas' };

export const CONTROLES = ['Apto', 'Húmedo', 'Mezclado', 'Contaminado'];

export const FREC = { d: 'Diaria', s: 'Semanal', m: 'Mensual' };

export const TAREAS_BASE = [
  ['r1', 'recepcion', 'Pesar o contar cada entrega y emitir el ticket', 'd'],
  ['r2', 'recepcion', 'Controlar humedad e impurezas al recibir', 'd'],
  ['c1', 'clasificacion', 'Registrar separado y rechazo con su causa', 'd'],
  ['c2', 'clasificacion', 'Limpiar la cinta o la mesa al cerrar', 'd'],
  ['p1', 'proceso', 'Revisar la máquina antes de usarla', 'd'],
  ['p2', 'proceso', 'Identificar cada fardo o bolsón con material y peso', 'd'],
  ['p3', 'proceso', 'Mantenimiento preventivo', 'm'],
  ['a1', 'acopio', 'Guardar papel y cartón bajo techo', 'd'],
  ['a2', 'acopio', 'Controlar el stock contra los registros', 's'],
  ['v1', 'venta', 'Comparar precios con la referencia antes de vender', 's'],
  ['v2', 'venta', 'Cargar ventas, cobros y gastos', 's'],
  ['v3', 'venta', 'Revisar el convenio y los contratos', 'm'],
  ['s1', 'seguridad', 'Controlar que todos usen sus elementos de protección', 'd'],
  ['s2', 'seguridad', 'Limpieza de baños, comedor y predio', 'd'],
  ['s3', 'seguridad', 'Revisar matafuegos y salidas', 'm'],
];

export const TIPOS_OBL = { cantidad: 'Cantidad por mes', pago: 'Pago por mes ($)', servicio: 'Se cumple o no' };

export const CONCEPTOS = {
  Ingreso: ['Servicio a grandes generadores', 'Pago del municipio', 'Subsidio o programa', 'Otros ingresos'],
  Egreso: ['Retiros o sueldos', 'Mantenimiento y repuestos', 'Luz, agua y gas', 'Seguros', 'Indumentaria y EPP', 'Fletes y alquileres', 'Otros egresos'],
};
