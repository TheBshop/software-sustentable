import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api';
import { onQueueChange, syncNow, discardPending } from '../offline/syncQueue';
import { C, ui } from '../theme';

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const hora = (d) => new Date(d).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
const kg = (n) => `${Number(n).toLocaleString('es-AR', { maximumFractionDigits: 1 })} kg`;

/**
 * Los retiros del día del chofer: los que ya llegaron al servidor y los que todavía
 * están en el teléfono esperando señal. Sirve para saber qué se hizo y qué falta enviar.
 */
export default function MisRetirosScreen({ notify, refreshKey }) {
  const [enviados, setEnviados] = useState([]);
  const [cola, setCola] = useState({ pending: [], syncing: false });
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(false);
  const cacheKey = `misRetiros-${hoyISO()}`;

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const { items } = await api(`/retiros?desde=${hoyISO()}&hasta=${hoyISO()}&limit=100`);
      setEnviados(items);
      setOffline(false);
      await AsyncStorage.setItem(cacheKey, JSON.stringify(items));
    } catch {
      setOffline(true);
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) setEnviados(JSON.parse(cached));
    } finally {
      setLoading(false);
    }
  }, [cacheKey]);

  useEffect(() => {
    cargar();
  }, [cargar, refreshKey]);

  useEffect(
    () =>
      onQueueChange((state) => {
        setCola((prev) => {
          // Cuando algo de la cola llega al servidor, se recarga la lista de enviados
          if (prev.pending.length > state.pending.length) cargar();
          return state;
        });
      }),
    [cargar],
  );

  async function refrescar() {
    const n = await syncNow();
    if (n) notify(`${n} retiro${n > 1 ? 's' : ''} enviado${n > 1 ? 's' : ''}`);
    await cargar();
  }

  const pendientes = cola.pending.map((p) => ({ ...p, _pendiente: true }));
  const filas = [...pendientes.slice().reverse(), ...enviados];
  const totalKg =
    pendientes.reduce((a, p) => a + p.items.reduce((b, i) => b + i.pesoEstimadoKg, 0), 0) +
    enviados.reduce((a, r) => a + r.items.reduce((b, i) => b + (i.pesoRealKg ?? i.pesoEstimadoKg), 0), 0);

  return (
    <FlatList
      data={filas}
      keyExtractor={(r) => r._id ?? r.localId}
      contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={loading || cola.syncing} onRefresh={refrescar} colors={[C.verde]} />}
      ListHeaderComponent={
        <View style={{ gap: 10, marginBottom: 4 }}>
          <View style={s.resumen}>
            <View>
              <Text style={s.resumenNum}>{filas.length}</Text>
              <Text style={ui.muted}>retiros hoy</Text>
            </View>
            <View>
              <Text style={s.resumenNum}>{kg(totalKg)}</Text>
              <Text style={ui.muted}>recolectados</Text>
            </View>
          </View>
          {offline && <Text style={s.offline}>Sin conexión: se muestra lo último que se descargó.</Text>}
          {pendientes.length > 0 && (
            <TouchableOpacity style={ui.buttonSecondary} onPress={refrescar} disabled={cola.syncing} accessibilityRole="button">
              <Text style={ui.buttonSecondaryText}>{cola.syncing ? 'Enviando…' : `Enviar ${pendientes.length} pendiente${pendientes.length > 1 ? 's' : ''} ahora`}</Text>
            </TouchableOpacity>
          )}
        </View>
      }
      ListEmptyComponent={<Text style={[ui.muted, { textAlign: 'center', marginTop: 24 }]}>Todavía no registraste retiros hoy.</Text>}
      renderItem={({ item: r }) => <Fila r={r} onDiscard={() => discardPending(r.localId)} />}
    />
  );
}

function Fila({ r, onDiscard }) {
  const [confirmar, setConfirmar] = useState(false);
  const total = r.items.reduce((a, i) => a + (i.pesoRealKg ?? i.pesoEstimadoKg), 0);
  let estado;
  if (r._pendiente && r.error) estado = { texto: 'Rechazado', bg: C.rojoClaro, fg: C.rojo };
  else if (r._pendiente) estado = { texto: 'Sin enviar', bg: C.solClaro, fg: C.solTexto };
  else if (r.certificado) estado = { texto: 'Certificado', bg: C.verdeClaro, fg: C.verdeOscuro };
  else if (r.estado === 'en_planta') estado = { texto: 'Pesado en planta', bg: C.azulClaro, fg: C.azul };
  else estado = { texto: 'Enviado', bg: C.verdeClaro, fg: C.verdeOscuro };

  return (
    <View style={s.card}>
      <View style={s.cardTop}>
        <Text style={s.cliente} numberOfLines={1}>{r.cliente?.razonSocial ?? r.clienteNombre ?? 'Cliente dado de baja'}</Text>
        <Text style={[s.estado, { backgroundColor: estado.bg, color: estado.fg }]}>{estado.texto}</Text>
      </View>
      <Text style={ui.muted}>
        {hora(r.fecha)}
        {r.numero ? ` · N° ${String(r.numero).padStart(5, '0')}` : ''} · {kg(total)}
        {r._pendiente && r.fotos?.length ? ` · ${r.fotos.length} foto${r.fotos.length > 1 ? 's' : ''}` : ''}
      </Text>
      {!r._pendiente && <Text style={s.materiales}>{r.items.map((i) => `${i.material?.nombre ?? 'Material'} ${kg(i.pesoRealKg ?? i.pesoEstimadoKg)}`).join(' · ')}</Text>}
      {r.error && (
        <View style={{ marginTop: 6, gap: 6 }}>
          <Text style={ui.error}>{r.error}</Text>
          {confirmar ? (
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <TouchableOpacity onPress={onDiscard}><Text style={[ui.error, { fontWeight: '700' }]}>Sí, descartar</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setConfirmar(false)}><Text style={ui.muted}>No</Text></TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setConfirmar(true)}><Text style={[ui.error, { textDecorationLine: 'underline' }]}>Descartar y volver a cargarlo</Text></TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  resumen: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: 'white', borderRadius: 10, padding: 14 },
  resumenNum: { fontSize: 22, fontWeight: '800', color: C.verdeOscuro, textAlign: 'center' },
  offline: { backgroundColor: C.solClaro, color: C.solTexto, padding: 10, borderRadius: 8, fontSize: 13 },
  card: { backgroundColor: 'white', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#e5e7eb' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 2 },
  cliente: { flex: 1, fontSize: 16, fontWeight: '700', color: C.texto },
  estado: { fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  materiales: { fontSize: 14, color: '#374151', marginTop: 4 },
});
