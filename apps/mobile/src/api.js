import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Para apuntar a otra API sin tocar app.json: EXPO_PUBLIC_API_URL=https://api... npx expo start
// En la versión web de desarrollo (npm run web) se usa la API en el mismo host, puerto 4000.
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === 'web' && typeof location !== 'undefined' ? `http://${location.hostname}:4000` : Constants.expoConfig?.extra?.apiUrl);

// MVP: el token se guarda en AsyncStorage. Antes de producción, pasarlo a expo-secure-store.
const TOKEN = 'token';
const USER = 'user';

const unauthorizedListeners = new Set();
/** La app se suscribe para volver al login cuando el servidor rechaza el token. */
export const onUnauthorized = (fn) => (unauthorizedListeners.add(fn), () => unauthorizedListeners.delete(fn));

export async function api(path, { method = 'GET', body, formData } = {}) {
  const token = await AsyncStorage.getItem(TOKEN);
  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(formData ? {} : { 'Content-Type': 'application/json' }),
    },
    body: formData ?? (body ? JSON.stringify(body) : undefined),
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token) unauthorizedListeners.forEach((fn) => fn());
    const err = new Error(data?.error ?? `Error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// ---------- Sesión ----------

export async function login(email, password) {
  let res;
  try {
    res = await api('/auth/login', { method: 'POST', body: { email: email.trim(), password } });
  } catch (err) {
    if (err.status === 401) throw new Error('Email o contraseña incorrectos.');
    if (!err.status) throw new Error('No hay conexión con el servidor. El primer ingreso necesita señal.');
    throw err;
  }
  if (res.user.organizacion?.tipo !== 'cooperativa') {
    throw new Error('Esta app es para el personal de las cooperativas. Las empresas y municipios usan el portal web.');
  }
  await AsyncStorage.multiSet([[TOKEN, res.token], [USER, JSON.stringify(res.user)]]);
  return res.user;
}

/** Usuario guardado en el teléfono: permite abrir la app y cargar retiros sin señal. */
export async function getSession() {
  const [[, token], [, user]] = await AsyncStorage.multiGet([TOKEN, USER]);
  return token && user ? JSON.parse(user) : null;
}

export async function logout() {
  await AsyncStorage.multiRemove([TOKEN, USER]);
}

// ---------- Catálogo ----------

/** Clientes y materiales se cachean para poder cargar retiros sin señal. */
export async function getCatalog() {
  try {
    const [clientes, materiales] = await Promise.all([api('/clientes?limit=200'), api('/materiales?limit=200')]);
    const catalog = { clientes: clientes.items.filter((c) => c.tipo !== 'comprador'), materiales: materiales.items };
    await AsyncStorage.setItem('catalog', JSON.stringify(catalog));
    return catalog;
  } catch {
    const cached = await AsyncStorage.getItem('catalog');
    return cached ? JSON.parse(cached) : { clientes: [], materiales: [] };
  }
}

/** Arma el FormData de fotos: en el teléfono va el uri; en la web hay que leer el archivo. */
export async function fotosFormData(uris) {
  const fd = new FormData();
  for (const [i, uri] of uris.entries()) {
    if (Platform.OS === 'web') fd.append('fotos', await (await fetch(uri)).blob(), `foto-${i}.jpg`);
    else fd.append('fotos', { uri, name: `foto-${i}.jpg`, type: 'image/jpeg' });
  }
  return fd;
}
