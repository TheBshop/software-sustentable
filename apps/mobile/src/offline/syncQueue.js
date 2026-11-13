import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { api } from '../api';

// Cola offline: el chofer siempre guarda en el teléfono primero y la app sincroniza
// cuando hay conexión. Cada retiro lleva un `localId` (UUID) y el backend es idempotente
// por ese campo, así que reintentar nunca duplica retiros.
const KEY = 'pendingPickups';
const listeners = new Set();

export async function getPending() {
  return JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]');
}

async function savePending(list) {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
  listeners.forEach((fn) => fn(list.length));
}

export const onPendingChange = (fn) => (listeners.add(fn), () => listeners.delete(fn));

export async function enqueuePickup(pickup) {
  await savePending([...(await getPending()), pickup]);
  syncNow();
}

let syncing = false;
export async function syncNow() {
  if (syncing) return;
  syncing = true;
  try {
    let pending = await getPending();
    for (const p of [...pending]) {
      if (p.error) continue; // ya rechazado por el servidor: lo revisa un administrativo
      const { fotos = [], error: _e, ...data } = p;
      try {
        const created = await api('/retiros', { method: 'POST', body: data });
        if (fotos.length) {
          const fd = new FormData();
          fotos.forEach((uri, i) => fd.append('fotos', { uri, name: `foto-${i}.jpg`, type: 'image/jpeg' }));
          await api(`/retiros/${created._id}/fotos`, { method: 'POST', formData: fd });
        }
        pending = pending.filter((x) => x.localId !== p.localId);
        await savePending(pending);
      } catch (err) {
        if (err.status === 400) {
          // Datos inválidos: no tiene sentido reintentar. Se deja marcado para revisión.
          p.error = err.message;
          await savePending(pending);
          continue;
        }
        break; // sin conexión u otro error: se reintenta más tarde
      }
    }
  } finally {
    syncing = false;
  }
}

export function startAutoSync() {
  syncNow();
  return NetInfo.addEventListener((state) => state.isConnected && syncNow());
}
