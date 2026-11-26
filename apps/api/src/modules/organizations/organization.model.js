import mongoose from 'mongoose';

// Organizaciones de la plataforma.
//   rol 'operador'  → contrata el software y gestiona residuos; es dueña de sus datos (ver lib/tenancy.js).
//                     Tipos: cooperativa, recicladora (empresa de reciclaje) o municipio.
//   rol 'generador' → cliente de un operador (comercio, industria, institución o dependencia
//                     municipal); entra gratis al portal (/api/v1/portal). Tipos: empresa o municipio.
//   rol 'plataforma' → la organización de los administradores del SaaS (una sola).
export const TIPOS_ORG = ['cooperativa', 'recicladora', 'municipio', 'empresa', 'vecino', 'plataforma'];
export const ROLES_ORG = ['operador', 'generador', 'vecino', 'plataforma'];
/** Rol por defecto: cooperativas y recicladoras operan; empresas y municipios sin rol son generadores (compatibilidad). */
export const rolPorDefecto = (tipo) => (tipo === 'plataforma' ? 'plataforma' : tipo === 'vecino' ? 'vecino' : ['cooperativa', 'recicladora'].includes(tipo) ? 'operador' : 'generador');
export const esOperador = (org) => (org?.rol ?? rolPorDefecto(org?.tipo)) === 'operador';

// Corrientes de residuos (ver docs/08-marco-normativo.md)
//   rsu           Ley 25.916 — residuos domiciliarios / sólidos urbanos
//   regu          Res. 522/2016 y 189/2019 — residuos especiales de generación universal
//   peligroso     Ley 24.051 — requiere inscripción como operador y manifiesto
//   industrial    Ley 25.612
//   fitosanitario Ley 27.279 — envases vacíos de fitosanitarios
export const CORRIENTES = ['rsu', 'regu', 'peligroso', 'industrial', 'fitosanitario'];

const organizationSchema = new mongoose.Schema(
  {
    tipo: { type: String, enum: TIPOS_ORG, required: true },
    rol: { type: String, enum: ROLES_ORG },
    // Configuración que elige la organización al empezar (asistente) y edita después
    configuracion: {
      residuos: { type: [String], default: undefined }, // secos, organicos, raee… (catálogo RESIDUOS)
      corrientes: { type: [String], default: undefined }, // tratamientos que hace (catálogo CORR)
      onboarding: { type: Boolean, default: false }, // terminó el asistente de configuración
      etapas: { type: mongoose.Schema.Types.Mixed }, // por corriente: índices de las etapas que hace
    },
    nombre: { type: String, required: true, trim: true },
    cuit: { type: String, trim: true, unique: true, sparse: true },
    // Solo cooperativas: corrientes que está habilitada a recibir y gestionar.
    habilitaciones: {
      corrientes: { type: [{ type: String, enum: CORRIENTES }], default: undefined },
      // N° de inscripción en registros específicos (ej. operador de residuos peligrosos)
      // Ej.: registro municipal de depósitos de acopio (Paraná, Ord. 9233 art. 28), inscripción provincial…
      registros: [{ _id: false, descripcion: String, corriente: { type: String, enum: CORRIENTES }, organismo: String, numero: String, vence: Date }],
    },
    domicilio: { type: String, trim: true }, // domicilio real de la planta (va en el certificado)
    condicionIva: { type: String, enum: ['responsable_inscripto', 'monotributo', 'exento', 'consumidor_final'] },
    // Datos que exige el certificado verde (ver modules/certificates/certificado-verde.js)
    certificadoVerde: {
      inaes: String, // matrícula INAES (cooperativas)
      habilitacionMunicipal: String,
      caa: String, // certificado de aptitud ambiental provincial
      registroProvincial: String, // destinos sustentables / registro provincial de operadores
      basculaVence: Date, // vencimiento de la calibración de la báscula
      transporte: { propio: { type: Boolean, default: true }, razonSocial: String, cuit: String, habilitacion: String },
      responsableTecnico: String, // plantas industriales
      matriculaTecnico: String,
      procesos: [String], // clasificación, enfardado, molienda, lavado, extrusión
    },
    // Solo cooperativas: quién firma los certificados, con firma y sello escaneados
    certificado: { responsable: String, cargo: String, firmaUrl: String, selloUrl: String },
    // Dónde opera (define el marco normativo que aplica: ver modules/normativa/jurisdicciones.js)
    jurisdiccion: { provincia: String, municipio: String, ciudad: String },
    // Solo prestadores: cooperativa, empresa recicladora, planta pública o asociación
    perfil: { type: String, enum: ["cooperativa", "empresa", "planta_publica", "asociacion"] },
    // Capacidad instalada y horas trabajables: base de los indicadores de productividad
    planta: {
      capacidadTnMes: Number,
      horasTrabajablesMes: Number,
      kgObjetivoRetiro: Number, // carga que conviene juntar por retiro (frecuencia sugerida)
      ubicacion: { lat: Number, lng: Number }, // punto de partida de la hoja de ruta
    },
    // Prototipo de demostración armado para mostrarle el sistema a la organización
    prototipo: { slug: String, notas: String, tambien: String },
    // Marca de piloto activo (vía npm run crear-piloto). Lo usa el panel de admin.
    piloto: { activo: Boolean, inicio: Date, notas: String },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true },
);

organizationSchema.pre('validate', function () {
  if (!this.rol) this.rol = rolPorDefecto(this.tipo);
  if (this.rol === 'operador' && !this.habilitaciones?.corrientes) {
    this.set('habilitaciones.corrientes', ['rsu']);
  }
});

export const Organization = mongoose.model('Organization', organizationSchema);
