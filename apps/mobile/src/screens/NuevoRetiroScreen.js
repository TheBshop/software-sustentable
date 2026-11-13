import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, StyleSheet, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Crypto from 'expo-crypto';
import { getCatalog } from '../api';
import { enqueuePickup, getPending, onPendingChange } from '../offline/syncQueue';

const VERDE = '#2f7d32';

/**
 * Pantalla principal del chofer: registrar un retiro en el momento.
 * Pensada para usarse con una mano, al sol y con guantes: botones grandes, pocos campos,
 * y funciona sin señal (guarda local y sincroniza después).
 */
export default function NuevoRetiroScreen() {
  const [catalog, setCatalog] = useState({ clientes: [], materiales: [] });
  const [busqueda, setBusqueda] = useState('');
  const [cliente, setCliente] = useState(null);
  const [pesos, setPesos] = useState({}); // { materialId: "120" }
  const [fotos, setFotos] = useState([]);
  const [observaciones, setObservaciones] = useState('');
  const [pendientes, setPendientes] = useState(0);

  useEffect(() => {
    getCatalog().then(setCatalog);
    getPending().then((l) => setPendientes(l.length));
    return onPendingChange(setPendientes);
  }, []);

  const clientesFiltrados = useMemo(
    () => catalog.clientes.filter((c) => c.razonSocial.toLowerCase().includes(busqueda.toLowerCase())).slice(0, 5),
    [busqueda, catalog.clientes],
  );
  const items = Object.entries(pesos)
    .filter(([, kg]) => Number(kg) > 0)
    .map(([material, kg]) => ({ material, pesoEstimadoKg: Number(kg) }));
  const totalKg = items.reduce((a, i) => a + i.pesoEstimadoKg, 0);

  async function sacarFoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert('Necesitamos permiso para usar la cámara');
    const r = await ImagePicker.launchCameraAsync({ quality: 0.5 }); // comprimida: ahorra datos móviles
    if (!r.canceled) setFotos((f) => [...f, r.assets[0].uri]);
  }

  async function guardar() {
    if (!cliente) return Alert.alert('Elegí el cliente');
    if (!items.length) return Alert.alert('Cargá al menos un material con peso');

    let ubicacion;
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (granted) {
        const pos = await Location.getLastKnownPositionAsync();
        if (pos) ubicacion = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      }
    } catch {
      /* la ubicación es opcional */
    }

    await enqueuePickup({
      localId: Crypto.randomUUID(),
      cliente: cliente._id,
      direccion: cliente.direcciones?.[0]?.direccion,
      fecha: new Date().toISOString(),
      items,
      fotos,
      ubicacion,
      observaciones: observaciones || undefined,
    });
    Alert.alert('Retiro guardado ✓', `${cliente.razonSocial} · ${totalKg} kg`);
    setCliente(null);
    setPesos({});
    setFotos([]);
    setObservaciones('');
    setBusqueda('');
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Nuevo retiro</Text>
        <Text style={[s.sync, pendientes ? s.syncPending : null]}>
          {pendientes ? `⟳ ${pendientes} sin enviar` : '✓ Sincronizado'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <Text style={s.label}>1. Cliente</Text>
        {cliente ? (
          <TouchableOpacity style={s.selected} onPress={() => setCliente(null)}>
            <Text style={s.selectedName}>{cliente.razonSocial}</Text>
            <Text style={s.muted}>{cliente.direcciones?.[0]?.direccion ?? 'Sin dirección'} · cambiar</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TextInput style={s.input} placeholder="Buscar cliente…" value={busqueda} onChangeText={setBusqueda} />
            {clientesFiltrados.map((c) => (
              <TouchableOpacity key={c._id} style={s.option} onPress={() => setCliente(c)}>
                <Text style={s.optionText}>{c.razonSocial}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        <Text style={s.label}>2. Materiales (kg estimados)</Text>
        {catalog.materiales.map((m) => (
          <View key={m._id} style={s.materialRow}>
            <Text style={s.materialName}>{m.nombre}</Text>
            <TextInput
              style={s.kgInput}
              keyboardType="decimal-pad"
              placeholder="0"
              value={pesos[m._id] ?? ''}
              onChangeText={(v) => setPesos({ ...pesos, [m._id]: v.replace(',', '.') })}
            />
            <Text style={s.muted}>kg</Text>
          </View>
        ))}

        <Text style={s.label}>3. Fotos</Text>
        <View style={s.fotos}>
          {fotos.map((uri) => <Image key={uri} source={{ uri }} style={s.foto} />)}
          <TouchableOpacity style={s.addFoto} onPress={sacarFoto}>
            <Text style={{ fontSize: 28, color: VERDE }}>📷</Text>
          </TouchableOpacity>
        </View>

        <TextInput style={[s.input, { minHeight: 60 }]} placeholder="Observaciones (opcional)" multiline value={observaciones} onChangeText={setObservaciones} />
      </ScrollView>

      <View style={s.footer}>
        <Text style={s.total}>Total: {totalKg.toLocaleString('es-AR')} kg</Text>
        <TouchableOpacity style={s.button} onPress={guardar}>
          <Text style={s.buttonText}>Guardar retiro</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: { backgroundColor: VERDE, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: '700' },
  sync: { color: 'white', fontSize: 13, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  syncPending: { backgroundColor: '#f59e0b' },
  body: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 15, fontWeight: '700', marginTop: 16, marginBottom: 8, color: '#374151' },
  input: { backgroundColor: 'white', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 16 },
  option: { backgroundColor: 'white', padding: 14, borderBottomWidth: 1, borderColor: '#eee' },
  optionText: { fontSize: 16 },
  selected: { backgroundColor: '#e8f5e9', borderColor: VERDE, borderWidth: 1, borderRadius: 8, padding: 12 },
  selectedName: { fontSize: 17, fontWeight: '700', color: VERDE },
  muted: { color: '#6b7280', fontSize: 13 },
  materialRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 10, borderRadius: 8, marginBottom: 6, gap: 8 },
  materialName: { flex: 1, fontSize: 16 },
  kgInput: { width: 90, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, padding: 8, fontSize: 18, textAlign: 'right' },
  fotos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  foto: { width: 72, height: 72, borderRadius: 8 },
  addFoto: { width: 72, height: 72, borderRadius: 8, borderWidth: 2, borderStyle: 'dashed', borderColor: VERDE, alignItems: 'center', justifyContent: 'center' },
  footer: { padding: 16, backgroundColor: 'white', borderTopWidth: 1, borderColor: '#e5e7eb' },
  total: { fontSize: 15, marginBottom: 8, textAlign: 'center', color: '#374151' },
  button: { backgroundColor: VERDE, borderRadius: 10, padding: 16, alignItems: 'center' },
  buttonText: { color: 'white', fontSize: 18, fontWeight: '700' },
});
