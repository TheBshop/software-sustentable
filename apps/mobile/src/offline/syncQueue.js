import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { api, fotosFormData } from '../api';

// Cola offline: el chofer siempre guarda en el teléfono primero y la app sincroniza
// cuando hay conexión. Cada retiro lleva un `localId` (UUID) y el backend es idempotente
// por ese campo, así que reintentar nunca duplica retiros.
const KEY = 'pendingPickups';
const listeners = new Set();
let syncing = false;

export async function getPending() {
  return JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]');
}

async function savePending(list) {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
  notify(list);
}

function notify(list) {
  listeners.forEach((fn) => fn({ pending: list, syncing }));
}

/** fn recibe { pending: [...], syncing: bool } cada vez que cambia la cola. */
export function onQueueChange(fn) {
  listeners.add(fn);
  getPending().then((pending) => fn({ pending, syncing }));
  return () => listeners.delete(fn);
}

export async function enqueuePickup(pickup) {
  await savePending([...(await getPending()), pickup]);
  syncNow();
}

/** Envía lo pendiente. Devuelve cuántos retiros se enviaron. */
export async function syncNow() {
  if (syncing) return 0;
  syncing = true;
  let enviados = 0;
  let pending = await getPending();
  notify(pending);
  try {
    for (const p of [...pending]) {
      if (p.error) continue; // rechazado por el servidor: lo revisa administración
      const { fotos = [], error: _e, clienteNombre: _c, ...data } = p;
      try {
        const created = await api('/retiros', { method: 'POST', body: data });
        if (fotos.length) {
          try {
            await api(`/retiros/${created._id}/fotos`, { method: 'POST', formData: await fotosFormData(fotos) });
          } catch {
            // Si fallan las fotos el retiro igual queda registrado; no se reintenta para no bloquear la cola.
          }
        }
        pending = pending.filter((x) => x.localId !== p.localId);
        await savePending(pending);
        enviados++;
      } catch (err) {
        if (err.status === 400 || err.status === 422) {
          p.error = err.message; // datos inválidos: no tiene sentido reintentar
          await savePending(pending);
          continue;
        }
        break; // sin conexión o sesión vencida: se reintenta más tarde
      }
    }
  } finally {
    syncing = false;
    notify(pending);
  }
  return enviados;
}

export async function discardPending(localId) {
  await savePending((await getPending()).filter((p) => p.localId !== localId));
}

export function startAutoSync() {
  syncNow();
  return NetInfo.addEventListener((state) => state.isConnected && syncNow());
}
