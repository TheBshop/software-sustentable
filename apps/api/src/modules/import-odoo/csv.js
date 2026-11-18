// Parser CSV mínimo: separador coma, quoting con doble comilla, escape "" dentro de comillas.
// Devuelve array de objetos { [header]: valor } usando la primera fila como headers.
// Odoo exporta con ',' o ';'. Autodetecto por el primer header.
export function parseCsv(texto) {
  const normalizado = texto.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const sep = detectarSeparador(normalizado);
  const filas = parsearFilas(normalizado, sep);
  if (!filas.length) return [];
  const headers = filas[0].map((h) => h.trim());
  return filas.slice(1).filter((f) => f.some((c) => c !== '')).map((f) => Object.fromEntries(headers.map((h, i) => [h, (f[i] ?? '').trim()])));
}

function detectarSeparador(texto) {
  const primeraLinea = texto.split('\n', 1)[0];
  const comas = (primeraLinea.match(/,/g) ?? []).length;
  const puntos = (primeraLinea.match(/;/g) ?? []).length;
  return puntos > comas ? ';' : ',';
}

function parsearFilas(texto, sep) {
  const filas = [];
  let celda = '';
  let fila = [];
  let dentroComillas = false;
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i];
    if (dentroComillas) {
      if (c === '"' && texto[i + 1] === '"') { celda += '"'; i += 1; }
      else if (c === '"') { dentroComillas = false; }
      else { celda += c; }
    } else if (c === '"') {
      dentroComillas = true;
    } else if (c === sep) {
      fila.push(celda); celda = '';
    } else if (c === '\n') {
      fila.push(celda); filas.push(fila); fila = []; celda = '';
    } else {
      celda += c;
    }
  }
  if (celda !== '' || fila.length) { fila.push(celda); filas.push(fila); }
  return filas;
}
