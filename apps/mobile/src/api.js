import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_URL = Constants.expoConfig?.extra?.apiUrl ?? 'http://localhost:4000';

export async function api(path, { method = 'GET', body, formData } = {}) {
  const token = await AsyncStorage.getItem('token');
  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(formData ? {} : { 'Content-Type': 'application/json' }),
    },
    body: formData ?? (body ? JSON.stringify(body) : undefined),
  });
  const data = res.status === 204 ? null : await res.json();
  if (!res.ok) {
    const err = new Error(data?.error ?? `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/** Clientes y materiales se cachean para poder cargar retiros sin señal. */
export async function getCatalog() {
  try {
    const [clientes, materiales] = await Promise.all([api('/clientes?tipo=generador&limit=200'), api('/materiales?limit=200')]);
    const catalog = { clientes: clientes.items, materiales: materiales.items };
    await AsyncStorage.setItem('catalog', JSON.stringify(catalog));
    return catalog;
  } catch {
    const cached = await AsyncStorage.getItem('catalog');
    return cached ? JSON.parse(cached) : { clientes: [], materiales: [] };
  }
}
