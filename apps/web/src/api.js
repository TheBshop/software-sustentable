const BASE = import.meta.env.VITE_API_URL ?? '';

export const getToken = () => localStorage.getItem('token');
export const setToken = (t) => (t ? localStorage.setItem('token', t) : localStorage.removeItem('token'));

const authHeader = () => (getToken() ? { Authorization: `Bearer ${getToken()}` } : {});

function handle401(res) {
  if (res.status === 401 && getToken()) {
    setToken(null);
    window.location.href = '/login';
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: body ? JSON.stringify(body) : undefined,
  });
  handle401(res);
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.details?.[0]?.message ? `${data.error}: ${data.details[0].message}` : (data.error ?? 'Error de red'));
  return data;
}

/** Abre en otra pestaña un PDF que requiere login (no se puede usar un <a href> común). */
export async function openPdf(path) {
  const win = window.open('', '_blank'); // se abre ya, en el click, para que el navegador no lo bloquee
  const res = await fetch(`${BASE}/api${path}`, { headers: authHeader() });
  handle401(res);
  if (!res.ok) {
    win?.close();
    throw new Error('No se pudo generar el PDF');
  }
  const url = URL.createObjectURL(await res.blob());
  if (win) win.location.href = url;
  else window.location.href = url;
}

export const publicPdfUrl = (codigo) => `${BASE}/api/public/certificados/${codigo}/pdf`;

export const fmtKg = (n) => `${Number(n ?? 0).toLocaleString('es-AR', { maximumFractionDigits: 1 })} kg`;
// Sin centavos para montos redondos; con centavos para tarifas como $0,70/kg
export const fmtPeso = (n) => {
  const v = Number(n ?? 0);
  return v.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
};
export const fmtFecha = (d) => (d ? new Date(d).toLocaleDateString('es-AR') : '—');
export const fmtFechaCorta = (d) => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
/** "2026-11-13" en hora local, para <input type="date"> */
export const isoDate = (d = new Date()) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
export const pad = (n, w = 5) => String(n ?? '').padStart(w, '0');
