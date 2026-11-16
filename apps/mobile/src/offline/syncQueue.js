import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { api, fotosFormData, fotoFormData } from '../api';

// Cola offline: el chofer siempre guarda en el teléfono primero y la app sincroniza
// cuando hay conexión. Cada retiro lleva un `localId` (UUID) y el backend es idempotente
// por ese campo, así que reintentar nunca duplica retiros.
const KEY = 'pendingPickups';
const VISITAS = 'pendingVisitas'; // pedidos que no se pudieron retirar (con motivo), a informar
const listeners = new Set();
let syncing = false;

export async function getPending() {
  return JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]');
}

async function savePending(list) {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
  notify(list);
}

let visitasCache = [];
function notify(list) {
  listeners.forEach((fn) => fn({ pending: list, visitas: visitasCache, syncing }));
}

export async function getVisitas() {
  visitasCache = JSON.parse((await AsyncStorage.getItem(VISITAS)) ?? '[]');
  return visitasCache;
}
async function saveVisitas(list) {
  visitasCache = list;
  await AsyncStorage.setItem(VISITAS, JSON.stringify(list));
  notify(await getPending());
}

/** Visita en la que no se pudo retirar: se guarda y se informa cuando hay señal. */
export async function enqueueVisita(visita) {
  await saveVisitas([...(await getVisitas()), visita]);
  syncNow();
}

/** fn recibe { pending: [...], syncing: bool } cada vez que cambia la cola. */
export function onQueueChange(fn) {
  listeners.add(fn);
  Promise.all([getPending(), getVisitas()]).then(([pending, visitas]) => fn({ pending, visitas, syncing }));
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
    // Visitas fallidas (después de los retiros)
    for (const v of [...(await getVisitas())]) {
      if (v.error) continue;
      try {
        const campos = { motivo: v.motivo, detalle: v.detalle };
        await api(`/solicitudes/${v.solicitud}/no-realizado`, v.foto ? { method: 'POST', formData: await fotoFormData(v.foto, campos) } : { method: 'POST', body: campos });
        await saveVisitas(visitasCache.filter((x) => x.localId !== v.localId));
      } catch (err) {
        if (err.status && err.status < 500 && err.status !== 401) {
          // El pedido ya estaba cerrado o no existe: no se reintenta
          await saveVisitas(visitasCache.map((x) => (x.localId === v.localId ? { ...x, error: err.message } : x)));
          continue;
        }
        break;
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
