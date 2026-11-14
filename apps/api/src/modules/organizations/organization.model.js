import mongoose from 'mongoose';

// Organizaciones de la plataforma.
//   cooperativa → presta el servicio; es la dueña de sus datos operativos (ver lib/tenancy.js)
//   empresa / municipio → clientes generadores; entran al portal (/api/v1/portal)
export const TIPOS_ORG = ['cooperativa', 'empresa', 'municipio'];

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
    nombre: { type: String, required: true, trim: true },
    cuit: { type: String, trim: true, unique: true, sparse: true },
    // Solo cooperativas: corrientes que está habilitada a recibir y gestionar.
    habilitaciones: {
      corrientes: { type: [{ type: String, enum: CORRIENTES }], default: undefined },
      // N° de inscripción en registros específicos (ej. operador de residuos peligrosos)
      // Ej.: registro municipal de depósitos de acopio (Paraná, Ord. 9233 art. 28), inscripción provincial…
      registros: [{ _id: false, descripcion: String, corriente: { type: String, enum: CORRIENTES }, organismo: String, numero: String, vence: Date }],
    },
    // Solo cooperativas: quién firma los certificados, con firma y sello escaneados
    certificado: { responsable: String, cargo: String, firmaUrl: String, selloUrl: String },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true },
);

organizationSchema.pre('validate', function () {
  if (this.tipo === 'cooperativa' && !this.habilitaciones?.corrientes) {
    this.set('habilitaciones.corrientes', ['rsu']);
  }
});

export const Organization = mongoose.model('Organization', organizationSchema);
