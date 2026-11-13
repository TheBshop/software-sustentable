import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import NuevoRetiroScreen from './src/screens/NuevoRetiroScreen';
import MisRetirosScreen from './src/screens/MisRetirosScreen';
import LoginScreen from './src/screens/LoginScreen';
import { getSession, logout, onUnauthorized } from './src/api';
import { startAutoSync, onQueueChange } from './src/offline/syncQueue';
import { C } from './src/theme';

const TABS = { nuevo: 'Nuevo retiro', mios: 'Mis retiros' };

export default function Root() {
  return (
    <SafeAreaProvider>
      <App />
    </SafeAreaProvider>
  );
}

function App() {
  const [user, setUser] = useState(undefined); // undefined = cargando, null = sin sesión
  const [aviso, setAviso] = useState(null);
  const [tab, setTab] = useState('nuevo');
  const [cola, setCola] = useState({ pending: [], syncing: false });
  const [toast, setToast] = useState(null);
  const [menu, setMenu] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const toastTimer = useRef();

  useEffect(() => {
    getSession().then(setUser);
    // Token vencido o revocado: se vuelve al login sin perder los retiros guardados.
    return onUnauthorized(async () => {
      await logout();
      setAviso('Tu sesión venció. Ingresá de nuevo; los retiros sin enviar se conservan.');
      setUser(null);
    });
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    const stopSync = startAutoSync();
    const stopQueue = onQueueChange(setCola);
    return () => {
      stopSync();
      stopQueue();
    };
  }, [user]);

  function notify(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  async function salir() {
    setMenu(false);
    if (cola.pending.length) {
      notify(`Hay ${cola.pending.length} retiro(s) sin enviar. Conectate y enviálos antes de salir.`);
      return;
    }
    await logout();
    setUser(null);
    setAviso(null);
  }

  if (user === undefined) {
    return (
      <View style={[s.root, { justifyContent: 'center' }]}>
        <ActivityIndicator color={C.verde} size="large" />
      </View>
    );
  }
  if (!user) {
    return (
      <SafeAreaView style={s.root}>
        <StatusBar style="dark" />
        <LoginScreen onLogin={(u) => { setAviso(null); setUser(u); setTab('nuevo'); }} aviso={aviso} />
      </SafeAreaView>
    );
  }

  const n = cola.pending.length;
  return (
    <SafeAreaView style={s.root}>
      <StatusBar style="light" />
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>{TABS[tab]}</Text>
          <TouchableOpacity onPress={() => setMenu(!menu)} accessibilityRole="button">
            <Text style={s.headerUser}>{user.nombre} ▾</Text>
          </TouchableOpacity>
        </View>
        <Text style={[s.sync, n ? s.syncPending : null]} accessibilityLiveRegion="polite">
          {cola.syncing ? 'Enviando…' : n ? `${n} sin enviar` : '✓ Sincronizado'}
        </Text>
      </View>
      {menu && (
        <View style={s.menu}>
          <TouchableOpacity onPress={salir} style={{ padding: 12 }} accessibilityRole="button">
            <Text style={{ color: C.rojo, fontWeight: '600' }}>Cerrar sesión</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ flex: 1 }}>
        {tab === 'nuevo' ? (
          <NuevoRetiroScreen notify={notify} onSaved={() => setRefreshKey((k) => k + 1)} />
        ) : (
          <MisRetirosScreen notify={notify} refreshKey={refreshKey} />
        )}
        {toast && (
          <View style={s.toast} accessibilityLiveRegion="polite">
            <Text style={s.toastText}>{toast}</Text>
          </View>
        )}
      </View>

      <View style={s.tabs} accessibilityRole="tablist">
        {Object.entries(TABS).map(([k, label]) => (
          <TouchableOpacity key={k} style={[s.tab, tab === k && s.tabActive]} onPress={() => { setTab(k); setMenu(false); }} accessibilityRole="tab" accessibilityState={{ selected: tab === k }}>
            <Text style={[s.tabText, tab === k && s.tabTextActive]}>
              {label}
              {k === 'mios' && n ? ` (${n})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.fondo },
  header: { backgroundColor: C.verde, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: '700' },
  headerUser: { color: '#d7ecd8', fontSize: 13 },
  sync: { color: 'white', fontSize: 13, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
  syncPending: { backgroundColor: C.sol, color: '#3a2a03' },
  menu: { backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 4 },
  tabs: { flexDirection: 'row', backgroundColor: 'white', borderTopWidth: 1, borderColor: '#e5e7eb' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderTopWidth: 3, borderColor: 'transparent' },
  tabActive: { borderColor: C.verde },
  tabText: { fontSize: 15, color: C.gris, fontWeight: '600' },
  tabTextActive: { color: C.verde },
  toast: { position: 'absolute', left: 16, right: 16, bottom: 120, backgroundColor: '#1f2937', borderRadius: 10, padding: 12 },
  toastText: { color: 'white', fontSize: 14 },
});
