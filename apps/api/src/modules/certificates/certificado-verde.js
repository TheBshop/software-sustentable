// Certificado verde (Certificado de Destino Sustentable, de Tratamiento y Disposición o de
// Valorización, según la jurisdicción). Corta la responsabilidad del generador solo si lo
// emite un operador habilitado y si tiene los 6 requisitos formales:
//   1. identificación de las partes (generador, operador, transportista)
//   2. números de habilitación del operador
//   3. trazabilidad del traslado (remito, carta de porte o manifiesto)
//   4. detalle técnico y gravimétrico (fecha, corrientes, kg netos en báscula calibrada)
//   5. destino y proceso (tratamiento, reinserción, rechazo y balance de masa)
//   6. firma responsable (y responsable técnico en plantas industriales)

/** CUIT con dígito verificador válido. */
export function cuitValido(v) {
  const d = String(v ?? '').replace(/\D/g, '');
  if (d.length !== 11) return false;
  const p = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const r = 11 - (p.reduce((a, w, i) => a + w * Number(d[i]), 0) % 11);
  const dv = r === 11 ? 0 : r === 10 ? null : r;
  return dv === Number(d[10]);
}

export const JURISDICCIONES_CERTIFICADO = {
  buenos_aires: { documento: 'Certificado de Destino Sustentable', registro: 'Inscripción en el Registro de Destinos Sustentables (Res. OPDS 44/2021)', exigeManifiesto: true },
  caba: { documento: 'Constancia de recepción y tratamiento', registro: 'Inscripción en el RUR (cooperativas) o habilitación de la APrA (operadores privados)' },
  entre_rios: { documento: 'Certificado de valorización', registro: 'Inscripción en el registro de operadores de la Secretaría de Ambiente' },
  santa_fe: { documento: 'Certificado de valorización', registro: 'Inscripción en el Registro Provincial de Operadores de Residuos Industriales No Peligrosos' },
  cordoba: { documento: 'Certificado de valorización', registro: 'Inscripción en el registro provincial de operadores o centro verde municipal autorizado' },
};
const DEFAULT = { documento: 'Certificado de tratamiento y disposición', registro: 'Inscripción en el registro provincial de operadores' };
export const reglasJurisdiccion = (provincia) => JURISDICCIONES_CERTIFICADO[provincia] ?? DEFAULT;

const esCooperativa = (perfil) => !perfil || ['cooperativa', 'asociacion'].includes(perfil);

/** Requisitos de la organización emisora (no dependen de cada retiro). */
export function requisitosOrganizacion(org) {
  const v = org?.certificadoVerde ?? {};
  const reglas = reglasJurisdiccion(org?.jurisdiccion?.provincia);
  const tr = v.transporte ?? {};
  const transporteOk = tr.propio !== false ? true : tr.razonSocial && cuitValido(tr.cuit) && tr.habilitacion;
  const vence = v.basculaVence ? new Date(v.basculaVence) : null;
  return [
    { grupo: 'Identificación de las partes', texto: 'CUIT válido y domicilio de la planta', ok: Boolean(cuitValido(org?.cuit) && org?.domicilio) },
    { grupo: 'Identificación de las partes', texto: tr.propio !== false ? 'Transporte propio (la cooperativa figura como transportista)' : 'Transportista: razón social, CUIT válido y habilitación', ok: Boolean(transporteOk) },
    ...(esCooperativa(org?.perfil) ? [{ grupo: 'Números de habilitación', texto: 'Matrícula INAES', ok: Boolean(v.inaes) }] : []),
    { grupo: 'Números de habilitación', texto: 'Habilitación municipal', ok: Boolean(v.habilitacionMunicipal) },
    { grupo: 'Números de habilitación', texto: 'Certificado de aptitud ambiental', ok: Boolean(v.caa) },
    { grupo: 'Números de habilitación', texto: reglas.registro, ok: Boolean(v.registroProvincial) },
    { grupo: 'Detalle técnico y gravimétrico', texto: 'Báscula con calibración vigente', ok: Boolean(vence && vence >= new Date()) },
    { grupo: 'Destino y proceso', texto: 'Procesos que aplica la planta (clasificación, enfardado…)', ok: Boolean(v.procesos?.length) },
    { grupo: 'Firma responsable', texto: 'Representante legal y cargo', ok: Boolean(org?.certificado?.responsable && org?.certificado?.cargo) },
    ...(esCooperativa(org?.perfil) ? [] : [{ grupo: 'Firma responsable', texto: 'Responsable técnico matriculado', ok: Boolean(v.responsableTecnico && v.matriculaTecnico) }]),
  ];
}

/** Validez de un certificado ya armado (snapshot), con los 6 requisitos y la jurisdicción. */
export function validarCertificado(cert) {
  const e = cert.emisorSnapshot ?? {};
  const g = cert.clienteSnapshot ?? {};
  const t = cert.transportistaSnapshot ?? {};
  const reglas = reglasJurisdiccion(e.provincia);
  const coop = esCooperativa(e.perfil);
  const b = cert.balance ?? {};
  const req = [
    ['Identificación de las partes', 'Generador: razón social, CUIT válido y domicilio', g.razonSocial && cuitValido(g.cuit) && g.domicilio],
    ['Identificación de las partes', 'Operador: razón social, CUIT válido y domicilio de la planta', e.nombre && cuitValido(e.cuit) && e.domicilio],
    ['Identificación de las partes', 'Transportista: razón social y CUIT válido', t.razonSocial && cuitValido(t.cuit)],
    ...(coop ? [['Números de habilitación', 'Matrícula INAES', e.inaes]] : []),
    ['Números de habilitación', 'Habilitación municipal', e.habilitacionMunicipal],
    ['Números de habilitación', 'Certificado de aptitud ambiental', e.caa],
    ['Números de habilitación', reglas.registro, e.registroProvincial],
    ['Trazabilidad del traslado', 'Número de remito, carta de porte o manifiesto', cert.traslado?.numero],
    ...(reglas.exigeManifiesto ? [['Trazabilidad del traslado', 'Manifiesto de transporte digital', cert.traslado?.tipo === 'manifiesto']] : []),
    ['Detalle técnico y gravimétrico', 'Peso neto de cada corriente en báscula calibrada', cert.recepcion?.bascula],
    ['Destino y proceso', 'Tratamiento aplicado', cert.procesos?.length],
    ['Destino y proceso', 'Balance de masa: recibido = recuperado + rechazo', b.recibidoKg > 0 && Math.abs(b.recibidoKg - (b.recuperadoKg + b.rechazoKg)) <= b.recibidoKg * 0.01],
    ['Firma responsable', 'Representante legal y cargo', e.responsable && e.cargo],
    ...(coop ? [] : [['Firma responsable', 'Responsable técnico matriculado', e.responsableTecnico && e.matriculaTecnico]]),
  ];
  const faltan = req.filter(([, , ok]) => !ok).map(([grupo, texto]) => ({ grupo, texto }));
  return { completo: faltan.length === 0, documento: reglas.documento, faltan };
}
