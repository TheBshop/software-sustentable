// Consumos de servicios (electricidad, gas, agua) y combustible de la flota.
// Alimentan el reporte de huella de carbono junto con el CO2 evitado por recuperación de materiales.
import mongoose from 'mongoose';
import { tenantPlugin } from '../../lib/tenancy.js';
import { TIPOS_SERVICIO, TIPOS_COMBUSTIBLE, FACTOR_CO2_SERVICIO, FACTOR_CO2_COMBUSTIBLE } from './factores.js';

const consumoServicioSchema = new mongoose.Schema(
  {
    tipo: { type: String, enum: TIPOS_SERVICIO, required: true },
    fecha: { type: Date, required: true }, // fecha de la factura (período de consumo)
    periodoDesde: Date,
    periodoHasta: Date,
    cantidad: { type: Number, required: true, min: 0 }, // kWh, m³, kg según tipo
    unidad: { type: String, required: true },
    importe: { type: Number, default: 0, min: 0 },
    proveedor: { type: String, trim: true }, // Edenor, Metrogas, etc.
    sede: { type: String, trim: true }, // domicilio o punto de medición
    kgCo2: { type: Number, default: 0, min: 0 }, // calculado al guardar
    factorCo2PorUnidad: Number,
    fuenteFactor: String,
    observaciones: String,
  },
  { timestamps: true },
);

consumoServicioSchema.pre('save', function () {
  const f = FACTOR_CO2_SERVICIO[this.tipo];
  if (f) {
    this.factorCo2PorUnidad ??= f.kgCo2PorUnidad;
    this.fuenteFactor ??= f.fuente;
    this.kgCo2 = Math.round((this.cantidad * this.factorCo2PorUnidad) * 100) / 100;
  }
});

consumoServicioSchema.index({ fecha: -1 });
consumoServicioSchema.plugin(tenantPlugin);
export const ConsumoServicio = mongoose.model('ConsumoServicio', consumoServicioSchema);

const vehiculoSchema = new mongoose.Schema(
  {
    patente: { type: String, required: true, uppercase: true, trim: true },
    marca: String,
    modelo: String,
    anio: Number,
    tipoCombustible: { type: String, enum: TIPOS_COMBUSTIBLE, required: true },
    capacidadKg: Number,
    activo: { type: Boolean, default: true },
  },
  { timestamps: true },
);
vehiculoSchema.plugin(tenantPlugin);
vehiculoSchema.index({ coop: 1, patente: 1 }, { unique: true });
export const Vehiculo = mongoose.model('Vehiculo', vehiculoSchema);

const cargaCombustibleSchema = new mongoose.Schema(
  {
    vehiculo: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehiculo', required: true },
    fecha: { type: Date, required: true },
    tipoCombustible: { type: String, enum: TIPOS_COMBUSTIBLE, required: true },
    cantidad: { type: Number, required: true, min: 0 }, // L o m³ según tipo
    unidad: String,
    importe: { type: Number, default: 0, min: 0 },
    kmActual: Number,
    kgCo2: { type: Number, default: 0 },
    factorCo2PorUnidad: Number,
    fuenteFactor: String,
    observaciones: String,
  },
  { timestamps: true },
);

cargaCombustibleSchema.pre('save', function () {
  const f = FACTOR_CO2_COMBUSTIBLE[this.tipoCombustible];
  if (f) {
    this.factorCo2PorUnidad ??= f.kgCo2PorUnidad;
    this.fuenteFactor ??= f.fuente;
    this.unidad ??= f.unidad;
    this.kgCo2 = Math.round((this.cantidad * this.factorCo2PorUnidad) * 100) / 100;
  }
});

cargaCombustibleSchema.index({ fecha: -1 });
cargaCombustibleSchema.plugin(tenantPlugin);
export const CargaCombustible = mongoose.model('CargaCombustible', cargaCombustibleSchema);
