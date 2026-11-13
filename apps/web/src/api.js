const BASE = import.meta.env.VITE_API_URL ?? '';

export const getToken = () => localStorage.getItem('token');
export const setToken = (t) => (t ? localStorage.setItem('token', t) : localStorage.removeItem('token'));

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && getToken()) {
    setToken(null);
    window.location.href = '/login';
  }
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Error de red');
  return data;
}

export const publicPdfUrl = (codigo) => `${BASE}/api/public/certificados/${codigo}/pdf`;

export const fmtKg = (n) => `${Number(n ?? 0).toLocaleString('es-AR', { maximumFractionDigits: 1 })} kg`;
export const fmtPeso = (n) => Number(n ?? 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
