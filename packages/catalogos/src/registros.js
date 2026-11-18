// Definición de los registros de cada perfil (campos, ayudas y validaciones).
// Generado desde la página (nueva-vida-propuesta.html). Fuente única de estos datos para la API y la web.


export const MATS = ['Cartón', 'Papel', 'PET', 'PEAD', 'PEBD / film', 'PP', 'Vidrio', 'Aluminio', 'Chatarra', 'Tetra Pak', 'Otros'];

export const f = { fecha: { k: 'fecha', label: 'Fecha', tipo: 'fecha' }, mat: { k: 'material', label: 'Material', tipo: 'sel', op: MATS }, kg: { k: 'kg', label: 'Kg', tipo: 'num' } };

export const num = (k, label) => ({ k, label, tipo: 'num' });

export const txt = (k, label) => ({ k, label, tipo: 'texto' });

export const sel = (k, label, op) => ({ k, label, tipo: 'sel', op });

export const CAUSAS = ['Humedad', 'Mezclado', 'Contaminado', 'No reciclable', 'Otro'];

export const PERSONAL = { id: 'personal', nombre: 'Personal del mes', ayuda: 'Una fila por mes. Contá también a quienes estuvieron ausentes o de vacaciones.', mensual: true, campos: [num('personas', 'Personas'), num('formalizadas', 'Formalizadas'), num('diasTrab', 'Días trabajados (total)'), num('ausencias', 'Días de ausencia'), num('bajas', 'Bajas en el mes'), num('ingreso', 'Ingreso promedio ($)')] };

export const COMUNES = [
  { id: 'accidentes', nombre: 'Accidentes', ayuda: 'Cada accidente con los días de trabajo perdidos.', campos: [f.fecha, txt('persona', 'Persona'), num('dias', 'Días perdidos'), txt('que', 'Qué pasó')] },
  { id: 'paradas', nombre: 'Paradas de máquina', ayuda: 'Las paradas de más de medio turno.', campos: [f.fecha, sel('maquina', 'Máquina', ['Cinta', 'Prensa', 'Autoelevador', 'Otra']), num('horas', 'Horas'), sel('causa', 'Causa', ['Rotura', 'Corte de energía', 'Falta de material', 'Mantenimiento', 'Otra'])] },
  { id: 'combustible', nombre: 'Combustible', ayuda: 'Cargas de combustible de camiones y máquinas (Alcance 1 de la huella).', campos: [f.fecha, sel('combustible', 'Combustible', ['Gasoil', 'Nafta', 'GNC']), num('litros', 'Litros (m³ si es GNC)'), num('monto', 'Monto ($)')] },
  { id: 'electricidad', nombre: 'Electricidad', ayuda: 'Los kWh de cada factura de luz (Alcance 2 de la huella).', campos: [f.fecha, num('kwh', 'kWh'), num('monto', 'Monto ($)'), txt('comprobante', 'Factura N°')] },
  { id: 'epp', nombre: 'Entrega de EPP', ayuda: 'Elementos de protección entregados a cada persona.', campos: [f.fecha, txt('persona', 'Persona'), txt('elementos', 'Elementos')] },
  { id: 'capacitaciones', nombre: 'Capacitaciones', ayuda: 'Talleres de seguridad, operación o gestión.', campos: [f.fecha, txt('tema', 'Tema'), num('asistentes', 'Asistentes')] },
];

export const REG = {
  cooperativa: [
    { id: 'ingresos', nombre: 'Ingresos de material', ayuda: 'Todo lo que entra a la planta: camión municipal, retiros, recuperadores.', campos: [f.fecha, sel('origen', 'Origen', ['Recolección municipal', 'Retiro a generador', 'Recuperador', 'Entrega voluntaria']), f.mat, f.kg] },
    { id: 'separado', nombre: 'Separado y acopiado', ayuda: 'Lo que sale de la cinta o la mesa, listo para enfardar o vender.', campos: [f.fecha, f.mat, f.kg] },
    { id: 'rechazo', nombre: 'Rechazo', ayuda: 'Lo que va a disposición final, con su causa.', campos: [f.fecha, f.kg, sel('causa', 'Causa', CAUSAS)] },
    { id: 'ventas', nombre: 'Ventas', ayuda: 'Cada venta con su precio por kg.', campos: [f.fecha, txt('comprador', 'Comprador'), f.mat, f.kg, num('precio', '$ por kg')] },
    PERSONAL, ...COMUNES,
  ],
  empresa: [
    { id: 'compras', nombre: 'Compras de material', ayuda: 'Cada compra con su proveedor y precio.', campos: [f.fecha, txt('proveedor', 'Proveedor'), sel('tipoProv', 'Tipo de proveedor', ['Cooperativa', 'Recuperador', 'Generador', 'Acopiador']), f.mat, f.kg, num('precio', '$ por kg')] },
    { id: 'procesado', nombre: 'Procesado', ayuda: 'Lo que se clasificó, enfardó, molió o lavó en el mes.', campos: [f.fecha, f.mat, f.kg] },
    { id: 'rechazo', nombre: 'Descarte', ayuda: 'Lo que va a disposición final, con su causa.', campos: [f.fecha, f.kg, sel('causa', 'Causa', CAUSAS)] },
    { id: 'ventas', nombre: 'Ventas', ayuda: 'Cada venta a la industria, con su precio por kg.', campos: [f.fecha, txt('comprador', 'Cliente'), f.mat, f.kg, num('precio', '$ por kg')] },
    { id: 'traslados', nombre: 'Documentos de traslado', ayuda: 'Remitos, tickets de pesaje y manifiestos de cada traslado (Ley 25.612, art. 21).', campos: [f.fecha, sel('tipo', 'Documento', ['Remito', 'Ticket de pesaje', 'Manifiesto', 'Factura']), txt('numero', 'Número'), txt('origen', 'Origen o destino'), f.kg] },
    { id: 'constancias', nombre: 'Constancias de reciclado', ayuda: 'Las que se entregan a generadores para su declaración jurada (Ley 25.612, arts. 11 y 12).', campos: [f.fecha, txt('generador', 'Generador'), f.kg, sel('tratamiento', 'Tratamiento', ['Reciclado', 'Reúso', 'Compostaje'])] },
    PERSONAL, ...COMUNES,
  ],
  municipio: [
    { id: 'recoleccion', nombre: 'Recolección', ayuda: 'Toneladas recolectadas por circuito y tipo de recolección.', campos: [f.fecha, txt('zona', 'Circuito o zona'), sel('tipo', 'Tipo', ['Diferenciada: secos', 'Diferenciada: húmedos', 'Sin separar']), num('t', 'Toneladas')] },
    { id: 'destino', nombre: 'Destino', ayuda: 'A dónde fue cada tonelada.', campos: [f.fecha, sel('destino', 'Destino', ['Planta de clasificación o cooperativa', 'Compostaje', 'Relleno sanitario', 'Basural']), num('t', 'Toneladas')] },
    { id: 'costos', nombre: 'Costos', ayuda: 'Gastos del servicio en el mes.', campos: [f.fecha, sel('concepto', 'Concepto', ['Recolección', 'Transporte', 'Disposición final', 'Planta', 'Educación ambiental', 'Otros']), num('monto', 'Monto ($)')] },
    { id: 'grandes', nombre: 'Grandes generadores', ayuda: 'Padrón de comercios, industrias e instituciones que generan por encima del umbral.', sinMes: true, campos: [txt('razon', 'Razón social'), txt('rubro', 'Rubro'), num('kgMes', 'Kg por mes'), sel('inscripto', 'Inscripto', ['Sí', 'No']), sel('separa', 'Separa en origen', ['Sí', 'No'])] },
    { id: 'recuperadores', nombre: 'Recuperadores', ayuda: 'Censo de recuperadores urbanos (guía del BID para planes de inclusión).', sinMes: true, campos: [txt('nombre', 'Nombre'), txt('zona', 'Zona'), sel('vinculado', 'Trabaja con una cooperativa', ['Sí', 'No'])] },
    { id: 'basurales', nombre: 'Basurales', ayuda: 'Basurales a cielo abierto relevados y su estado.', sinMes: true, campos: [txt('ubicacion', 'Ubicación'), sel('estado', 'Estado', ['Activo', 'En saneamiento', 'Cerrado']), f.fecha] },
    { id: 'educacion', nombre: 'Educación ambiental', ayuda: 'Talleres, campañas y visitas.', campos: [f.fecha, txt('actividad', 'Actividad'), num('participantes', 'Participantes')] },
  ],
};

// Origen del dato: cada registro con kg indica cómo se pesó y con qué comprobante
for (const lista of Object.values(REG)) for (const d of lista) if (d.campos.some((c) => c.k === 'kg') && !d.campos.some((c) => c.k === 'pesaje')) d.campos.push(sel('pesaje', 'Pesaje', ['Báscula', 'Estimado']), txt('comprobante', 'Comprobante N°'));
