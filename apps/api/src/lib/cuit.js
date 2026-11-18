// Control del CUIT/CUIL por su dígito verificador (módulo 11, AFIP).
const PESOS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

export function cuitValido(cuit) {
  const d = String(cuit ?? '').replace(/\D/g, '');
  if (d.length !== 11) return false;
  const suma = PESOS.reduce((a, p, i) => a + p * Number(d[i]), 0);
  const resto = 11 - (suma % 11);
  const dv = resto === 11 ? 0 : resto === 10 ? 9 : resto;
  return dv === Number(d[10]);
}
