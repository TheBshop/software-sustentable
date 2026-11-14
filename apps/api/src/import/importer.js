// Importación inicial de materiales y clientes desde la planilla Excel que completa la cooperativa.
//
//   1. buildTemplate()   → genera la planilla vacía con instrucciones y listas desplegables
//   2. parseWorkbook()   → lee la planilla y valida fila por fila (sin tocar la base)
//   3. applyImport()     → crea o actualiza en la base (o simula, con dryRun)
//
// Es todo-o-nada: si hay un error en cualquier fila, no se escribe nada.
import ExcelJS from 'exceljs';
import { Material, materialInput } from '../modules/materials/material.model.js';
import { Client, clientInput } from '../modules/clients/client.model.js';
import { parseLocalDate } from '../lib/validation.js';
import { FRACCIONES, SUBTIPOS_REGU } from '../modules/materials/fracciones.js';

// ---------- Columnas y valores aceptados ----------

const MAT_COLS = [
  ['codigo', 'Código', 12],
  ['nombre', 'Nombre', 26],
  ['categoria', 'Categoría', 18],
  ['factorCo2', 'Factor CO2 (kg/kg)', 18],
  ['tarifaRetiroKg', 'Tarifa retiro ($/kg)', 18],
  ['precioVentaKg', 'Precio venta ($/kg)', 18],
  // Opcionales (las planillas generadas antes de agregarlas siguen siendo válidas)
  ['corriente', 'Corriente', 22, true],
  ['fraccion', 'Fracción', 22, true],
  ['subtipoRegu', 'Tipo de residuo especial', 28, true],
];

const CLI_COLS = [
  ['razonSocial', 'Razón social', 30],
  ['cuit', 'CUIT', 16],
  ['tipo', 'Tipo', 14],
  ['condicionIva', 'Condición IVA', 22],
  ['contactoNombre', 'Contacto', 18],
  ['email', 'Email', 26],
  ['telefono', 'WhatsApp', 18],
  ['direccion', 'Dirección de retiro', 30],
  ['modalidad', 'Modalidad de cobro', 18],
  ['montoFijo', 'Monto fijo ($)', 14],
  ['preciosPorKg', 'Precios por kg', 22],
  ['contratoNumero', 'N° contrato', 14],
  ['contratoInicio', 'Inicio contrato', 15],
  ['contratoFin', 'Fin contrato', 15],
  ['frecuencia', 'Frecuencia de retiro', 20],
  ['diasPago', 'Días para pagar', 14],
];

// Etiqueta que ve la cooperativa → valor interno
const OPCIONES = {
  categoria: {
    'Papel y cartón': 'papel_carton',
    Plásticos: 'plasticos',
    Vidrio: 'vidrio',
    Metales: 'metales',
    Electrónicos: 'electronicos',
    Otros: 'otros',
  },
  tipo: { Generador: 'generador', Comprador: 'comprador', Ambos: 'ambos' },
  condicionIva: {
    'Responsable inscripto': 'responsable_inscripto',
    Monotributo: 'monotributo',
    Exento: 'exento',
    'Consumidor final': 'consumidor_final',
  },
  modalidad: { 'Por retiro': 'por_retiro', 'Por kg': 'por_kg', 'Abono mensual': 'abono_mensual', 'Sin cargo': 'sin_cargo' },
  corriente: { 'Residuos urbanos (RSU)': 'rsu', 'Residuo especial (REGU)': 'regu', Peligroso: 'peligroso', Industrial: 'industrial', 'Envases fitosanitarios': 'fitosanitario' },
  fraccion: Object.fromEntries(Object.entries(FRACCIONES).map(([k, v]) => [v.nombre, k])),
  subtipoRegu: Object.fromEntries(Object.entries(SUBTIPOS_REGU).map(([k, v]) => [v, k])),
};

const norm = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

/** Acepta la etiqueta ("Papel y cartón"), el valor interno ("papel_carton") o variantes sin tildes. */
function opcion(campo, valor) {
  if (valor == null || valor === '') return undefined;
  const n = norm(valor);
  for (const [label, interno] of Object.entries(OPCIONES[campo])) {
    if (norm(label) === n || interno === n) return interno;
  }
  throw new Error(`"${valor}" no es válido. Opciones: ${Object.keys(OPCIONES[campo]).join(', ')}`);
}

// ---------- Lectura de celdas ----------

/** ExcelJS devuelve objetos para hipervínculos, fórmulas y texto enriquecido: los aplanamos. */
function cellValue(v) {
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if ('result' in v) return cellValue(v.result);
    if ('text' in v) return cellValue(v.text);
    if ('richText' in v) return v.richText.map((t) => t.text).join('');
    return null;
  }
  if (typeof v === 'string') {
    const t = v.trim();
    return t === '' ? null : t;
  }
  return v;
}

/** Números en formato argentino ("1.234,50", "40.000") o con punto decimal ("0.9"). */
function numero(v, campo) {
  if (v == null) return undefined;
  if (typeof v === 'number') return v;
  let s = String(v).replace(/\$|\s/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); // puntos como separador de miles
  const n = Number(s);
  if (Number.isNaN(n)) throw new Error(`${campo}: "${v}" no es un número`);
  return n;
}

/** Fechas como celda de fecha de Excel o texto dd/mm/aaaa. */
function fecha(v, campo) {
  if (v == null) return undefined;
  if (v instanceof Date) return v;
  const m = String(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [dd, mm, yyyy] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const check = new Date(Date.UTC(yyyy, mm - 1, dd));
    if (check.getUTCDate() === dd && check.getUTCMonth() === mm - 1) {
      // descarta 31/02, 32/13...; la fecha se guarda como medianoche de Argentina
      return parseLocalDate(`${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`);
    }
  }
  throw new Error(`${campo}: "${v}" no es una fecha (usá dd/mm/aaaa)`);
}

/** "VID=25; CART=8" → [{ codigo: 'VID', precio: 25 }, ...] */
function preciosPorKg(v) {
  if (v == null) return [];
  return String(v)
    .split(/[;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((par) => {
      const m = par.match(/^([A-Za-z0-9_]+)\s*[=:]\s*(.+)$/);
      if (!m) throw new Error(`Precios por kg: "${par}" debe tener la forma CODIGO=precio`);
      return { codigo: m[1].toUpperCase(), precio: numero(m[2], `Precio de ${m[1]}`) };
    });
}

function readSheet(ws, cols) {
  const rows = [];
  if (!ws) return rows;
  // Se ubican las columnas por el texto del encabezado, así no importa si la cooperativa las reordena.
  const header = {};
  ws.getRow(1).eachCell((cell, col) => (header[norm(cellValue(cell.value) ?? '')] = col));
  const faltan = cols.filter(([, label, , opcional]) => !opcional && !(norm(label) in header)).map(([, label]) => label);
  if (faltan.length) throw new Error(`Hoja "${ws.name}": faltan las columnas ${faltan.join(', ')}`);

  ws.eachRow((row, fila) => {
    if (fila === 1) return;
    const data = {};
    for (const [key, label] of cols) data[key] = norm(label) in header ? cellValue(row.getCell(header[norm(label)]).value) : null;
    if (Object.values(data).some((v) => v != null)) rows.push({ fila, data });
  });
  return rows;
}

const zodMsg = (err) => err.issues?.map((i) => `${i.path.join('.') || 'fila'}: ${i.message}`).join('; ') ?? err.message;

// ---------- API pública ----------

/** Lee y valida la planilla. No usa la base de datos. */
export function parseWorkbook(wb) {
  const errores = [];
  const materiales = [];
  const clientes = [];
  let matRows = [];
  let cliRows = [];

  try {
    matRows = readSheet(wb.getWorksheet('Materiales'), MAT_COLS);
    cliRows = readSheet(wb.getWorksheet('Clientes'), CLI_COLS);
  } catch (err) {
    return { materiales, clientes, errores: [{ hoja: '-', fila: 1, mensaje: err.message }] };
  }
  if (!wb.getWorksheet('Materiales') && !wb.getWorksheet('Clientes')) {
    errores.push({ hoja: '-', fila: 0, mensaje: 'La planilla no tiene hojas "Materiales" ni "Clientes"' });
  }

  const codigosVistos = new Map();
  for (const { fila, data } of matRows) {
    try {
      const parsed = materialInput.parse({
        codigo: data.codigo != null ? String(data.codigo).toUpperCase() : undefined,
        nombre: data.nombre ?? undefined,
        categoria: opcion('categoria', data.categoria),
        factorCo2: numero(data.factorCo2, 'Factor CO2') ?? 0,
        tarifaRetiroKg: numero(data.tarifaRetiroKg, 'Tarifa retiro') ?? 0,
        precioVentaKg: numero(data.precioVentaKg, 'Precio venta') ?? 0,
        corriente: opcion('corriente', data.corriente) ?? 'rsu',
        fraccion: opcion('fraccion', data.fraccion),
        subtipoRegu: opcion('subtipoRegu', data.subtipoRegu),
      });
      if (codigosVistos.has(parsed.codigo)) throw new Error(`Código ${parsed.codigo} repetido (también en la fila ${codigosVistos.get(parsed.codigo)})`);
      codigosVistos.set(parsed.codigo, fila);
      materiales.push({ fila, data: parsed });
    } catch (err) {
      errores.push({ hoja: 'Materiales', fila, mensaje: zodMsg(err) });
    }
  }

  const cuitsVistos = new Map();
  for (const { fila, data } of cliRows) {
    try {
      const precios = preciosPorKg(data.preciosPorKg);
      const contrato = {
        numero: data.contratoNumero != null ? String(data.contratoNumero) : undefined,
        inicio: fecha(data.contratoInicio, 'Inicio contrato'),
        fin: fecha(data.contratoFin, 'Fin contrato'),
        frecuenciaRetiro: data.frecuencia ?? undefined,
        diasPagoFactura: numero(data.diasPago, 'Días para pagar'),
      };
      const parsed = clientInput.parse({
        razonSocial: data.razonSocial ?? undefined,
        cuit: data.cuit != null ? String(data.cuit) : undefined,
        tipo: opcion('tipo', data.tipo) ?? 'generador',
        condicionIva: opcion('condicionIva', data.condicionIva),
        contacto: {
          nombre: data.contactoNombre ?? undefined,
          email: data.email ?? undefined,
          telefono: data.telefono != null ? String(data.telefono).replace(/[^\d]/g, '') : undefined,
        },
        direcciones: data.direccion ? [{ direccion: String(data.direccion) }] : [],
        tarifa: {
          modalidad: opcion('modalidad', data.modalidad) ?? 'por_retiro',
          montoFijo: numero(data.montoFijo, 'Monto fijo') ?? 0,
          preciosPorKg: [], // se resuelven contra la base en applyImport
        },
        contrato: Object.values(contrato).some((v) => v !== undefined) ? contrato : undefined,
      });
      if (parsed.cuit && cuitsVistos.has(parsed.cuit)) throw new Error(`CUIT ${parsed.cuit} repetido (también en la fila ${cuitsVistos.get(parsed.cuit)})`);
      if (parsed.cuit) cuitsVistos.set(parsed.cuit, fila);
      clientes.push({ fila, data: parsed, precios });
    } catch (err) {
      errores.push({ hoja: 'Clientes', fila, mensaje: zodMsg(err) });
    }
  }

  return { materiales, clientes, errores };
}

/**
 * Crea o actualiza materiales (por código) y clientes (por CUIT, o por razón social si no tiene).
 * Con dryRun: true informa qué haría sin escribir.
 */
export async function applyImport({ materiales, clientes }, { dryRun = false } = {}) {
  const resumen = { materiales: { nuevos: 0, actualizados: 0 }, clientes: { nuevos: 0, actualizados: 0 }, errores: [] };

  // Materiales existentes + los de la planilla, para resolver "Precios por kg" de los clientes
  const existentes = await Material.find({}, 'codigo');
  const codigos = new Set([...existentes.map((m) => m.codigo), ...materiales.map((m) => m.data.codigo)]);
  for (const c of clientes) {
    for (const p of c.precios) {
      if (!codigos.has(p.codigo)) resumen.errores.push({ hoja: 'Clientes', fila: c.fila, mensaje: `Precios por kg: el material ${p.codigo} no existe` });
    }
  }
  if (resumen.errores.length) return resumen;

  for (const { data } of materiales) {
    const doc = await Material.findOne({ codigo: data.codigo });
    resumen.materiales[doc ? 'actualizados' : 'nuevos']++;
    if (dryRun) continue;
    if (doc) {
      doc.set({ ...data, activo: true });
      await doc.save();
    } else await Material.create(data);
  }

  const idPorCodigo = dryRun ? new Map() : new Map((await Material.find({}, 'codigo')).map((m) => [m.codigo, m._id]));
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const { data, precios } of clientes) {
    const doc = data.cuit
      ? await Client.findOne({ cuit: data.cuit })
      : await Client.findOne({ razonSocial: { $regex: `^${escape(data.razonSocial)}$`, $options: 'i' } });
    resumen.clientes[doc ? 'actualizados' : 'nuevos']++;
    if (dryRun) continue;
    data.tarifa.preciosPorKg = precios.map((p) => ({ material: idPorCodigo.get(p.codigo), precio: p.precio }));
    if (doc) {
      doc.set({ ...data, activo: true });
      await doc.save();
    } else await Client.create(data);
  }
  return resumen;
}

/** Planilla vacía para que complete la cooperativa: encabezados, listas desplegables e instrucciones. */
export function buildTemplate() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Plataforma de gestión de residuos';

  const ins = wb.addWorksheet('Instrucciones');
  ins.getColumn(1).width = 110;
  const lineas = [
    ['Planilla de carga inicial de materiales y clientes', true],
    [''],
    ['Completá una fila por material en la hoja "Materiales" y una fila por cliente en la hoja "Clientes".'],
    ['No cambies los títulos de la primera fila. Las celdas vacías se toman como 0 o "sin dato".'],
    [''],
    ['MATERIALES', true],
    ['Código: corto y único, en mayúsculas (ej. CART, PET, VID). Se usa en "Precios por kg" de los clientes.'],
    ['Factor CO2: kg de CO2 que se evitan por cada kg reciclado. Si todavía no está definido, dejalo vacío.'],
    ['Tarifa retiro: lo que se le cobra al generador por kg retirado de ese material (0 si no se cobra).'],
    ['Precio venta: precio de referencia por kg cuando se vende el material.'],
    [`Categorías: ${Object.keys(OPCIONES.categoria).join(', ')}.`],
    ['Corriente (opcional, por defecto RSU): residuos urbanos, residuo especial (REGU: pilas, RAEE, neumáticos, aceite usado), peligroso, industrial o envases fitosanitarios.'],
    ['Fracción (opcional): según el código de colores del Decreto 779/2022. Si se deja vacía, se toma de la categoría.'],
    ['Tipo de residuo especial: obligatorio solo si la corriente es REGU.'],
    [''],
    ['CLIENTES', true],
    ['CUIT: con o sin guiones (30-12345678-9). Si el cliente ya existe, la planilla actualiza sus datos.'],
    ['WhatsApp: con código de país y área, sin 0 ni 15 (ej. 5493434123456).'],
    [`Tipo: ${Object.keys(OPCIONES.tipo).join(', ')}.   Modalidad de cobro: ${Object.keys(OPCIONES.modalidad).join(', ')}.`],
    ['Monto fijo: el precio por retiro (modalidad "Por retiro") o el abono del mes (modalidad "Abono mensual").'],
    ['Precios por kg: solo si el cliente tiene precios distintos a la tarifa general. Formato: CODIGO=precio separados por ";" (ej. VID=25; CART=8).'],
    ['Fechas de contrato: dd/mm/aaaa.   Días para pagar: plazo de pago de la factura (por defecto 15).'],
  ];
  lineas.forEach(([t, bold]) => {
    const r = ins.addRow([t]);
    if (bold) r.font = { bold: true, size: 13 };
  });

  const addSheet = (name, cols, listas) => {
    const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = cols.map(([key, header, width]) => ({ key, header, width }));
    const h = ws.getRow(1);
    h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F7D32' } };
    for (const [key, opciones] of Object.entries(listas)) {
      const col = cols.findIndex(([k]) => k === key) + 1;
      for (let r = 2; r <= 500; r++) {
        ws.getCell(r, col).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`"${Object.keys(opciones).join(',')}"`],
          showErrorMessage: true,
          errorTitle: 'Valor no válido',
          error: `Elegí una opción de la lista`,
        };
      }
    }
    return ws;
  };
  addSheet('Materiales', MAT_COLS, { categoria: OPCIONES.categoria, corriente: OPCIONES.corriente, fraccion: OPCIONES.fraccion, subtipoRegu: OPCIONES.subtipoRegu });
  addSheet('Clientes', CLI_COLS, { tipo: OPCIONES.tipo, condicionIva: OPCIONES.condicionIva, modalidad: OPCIONES.modalidad });
  return wb;
}
