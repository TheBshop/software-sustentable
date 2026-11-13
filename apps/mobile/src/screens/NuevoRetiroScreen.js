import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Crypto from 'expo-crypto';
import { getCatalog } from '../api';
import { enqueuePickup } from '../offline/syncQueue';
import { C, ui } from '../theme';

/**
 * Pantalla principal del chofer: registrar un retiro en el momento.
 * Pensada para usarse con una mano, al sol y con guantes: botones grandes, pocos campos,
 * y funciona sin señal (guarda local y sincroniza después).
 */
export default function NuevoRetiroScreen({ notify, onSaved }) {
  const [catalog, setCatalog] = useState({ clientes: [], materiales: [] });
  const [busqueda, setBusqueda] = useState('');
  const [cliente, setCliente] = useState(null);
  const [pesos, setPesos] = useState({}); // { materialId: "120" }
  const [fotos, setFotos] = useState([]);
  const [observaciones, setObservaciones] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    getCatalog().then(setCatalog);
  }, []);

  const clientesFiltrados = useMemo(
    () => catalog.clientes.filter((c) => c.razonSocial.toLowerCase().includes(busqueda.trim().toLowerCase())).slice(0, 5),
    [busqueda, catalog.clientes],
  );
  const items = Object.entries(pesos)
    .filter(([, kg]) => Number(kg) > 0)
    .map(([material, kg]) => ({ material, pesoEstimadoKg: Number(kg) }));
  const totalKg = items.reduce((a, i) => a + i.pesoEstimadoKg, 0);

  async function sacarFoto() {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      const r = perm.granted
        ? await ImagePicker.launchCameraAsync({ quality: 0.5 }) // comprimida: ahorra datos móviles
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.5 });
      if (!r.canceled) setFotos((f) => [...f, r.assets[0].uri]);
    } catch {
      setError('No se pudo abrir la cámara.');
    }
  }

  async function guardar() {
    if (!cliente) return setError('Elegí el cliente.');
    if (!items.length) return setError('Cargá al menos un material con su peso.');
    setError(null);

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
      clienteNombre: cliente.razonSocial, // solo para mostrarlo en "Mis retiros" mientras no se envía
      direccion: cliente.direcciones?.[0]?.direccion,
      fecha: new Date().toISOString(),
      items,
      fotos,
      ubicacion,
      observaciones: observaciones.trim() || undefined,
    });
    notify(`Retiro guardado · ${cliente.razonSocial} · ${totalKg.toLocaleString('es-AR')} kg`);
    setCliente(null);
    setPesos({});
    setFotos([]);
    setObservaciones('');
    setBusqueda('');
    onSaved?.();
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <Text style={[ui.label, { marginTop: 0 }]}>1. Cliente</Text>
        {cliente ? (
          <TouchableOpacity style={s.selected} onPress={() => setCliente(null)} accessibilityRole="button">
            <Text style={s.selectedName}>{cliente.razonSocial}</Text>
            <Text style={ui.muted}>{cliente.direcciones?.[0]?.direccion ?? 'Sin dirección'} · tocá para cambiar</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TextInput style={ui.input} placeholder="Buscar cliente…" value={busqueda} onChangeText={setBusqueda} accessibilityLabel="Buscar cliente" />
            {clientesFiltrados.map((c) => (
              <TouchableOpacity key={c._id} style={s.option} onPress={() => { setCliente(c); setError(null); }} accessibilityRole="button">
                <Text style={s.optionText}>{c.razonSocial}</Text>
              </TouchableOpacity>
            ))}
            {!catalog.clientes.length && <Text style={ui.muted}>Sin clientes guardados. Conectate una vez para descargarlos.</Text>}
          </>
        )}

        <Text style={ui.label}>2. Materiales (kg estimados)</Text>
        {catalog.materiales.map((m) => (
          <View key={m._id} style={s.materialRow}>
            <Text style={s.materialName}>{m.nombre}</Text>
            <TextInput
              style={s.kgInput}
              keyboardType="decimal-pad"
              placeholder="0"
              value={pesos[m._id] ?? ''}
              onChangeText={(v) => setPesos({ ...pesos, [m._id]: v.replace(',', '.') })}
              accessibilityLabel={`Kilos de ${m.nombre}`}
            />
            <Text style={ui.muted}>kg</Text>
          </View>
        ))}

        <Text style={ui.label}>3. Fotos</Text>
        <View style={s.fotos}>
          {fotos.map((uri) => <Image key={uri} source={{ uri }} style={s.foto} />)}
          {fotos.length < 6 && (
            <TouchableOpacity style={s.addFoto} onPress={sacarFoto} accessibilityRole="button" accessibilityLabel="Sacar foto">
              <Text style={{ fontSize: 26, color: C.verde }}>＋</Text>
              <Text style={{ fontSize: 11, color: C.verde }}>Foto</Text>
            </TouchableOpacity>
          )}
        </View>

        <TextInput style={[ui.input, { minHeight: 60 }]} placeholder="Observaciones (opcional)" multiline value={observaciones} onChangeText={setObservaciones} accessibilityLabel="Observaciones" />
      </ScrollView>

      <View style={s.footer}>
        {error && <Text style={[ui.error, { textAlign: 'center', marginBottom: 6 }]} accessibilityRole="alert">{error}</Text>}
        <Text style={s.total}>Total: {totalKg.toLocaleString('es-AR')} kg</Text>
        <TouchableOpacity style={ui.button} onPress={guardar} accessibilityRole="button">
          <Text style={ui.buttonText}>Guardar retiro</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  body: { padding: 16, paddingBottom: 40 },
  option: { backgroundColor: 'white', padding: 14, borderBottomWidth: 1, borderColor: '#eee' },
  optionText: { fontSize: 16, color: C.texto },
  selected: { backgroundColor: C.verdeClaro, borderColor: C.verde, borderWidth: 1, borderRadius: 8, padding: 12 },
  selectedName: { fontSize: 17, fontWeight: '700', color: C.verde },
  materialRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 10, borderRadius: 8, marginBottom: 6, gap: 8 },
  materialName: { flex: 1, fontSize: 16, color: C.texto },
  kgInput: { width: 90, borderWidth: 1, borderColor: C.borde, borderRadius: 6, padding: 8, fontSize: 18, textAlign: 'right', backgroundColor: 'white' },
  fotos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  foto: { width: 72, height: 72, borderRadius: 8 },
  addFoto: { width: 72, height: 72, borderRadius: 8, borderWidth: 2, borderStyle: 'dashed', borderColor: C.verde, alignItems: 'center', justifyContent: 'center' },
  footer: { padding: 16, backgroundColor: 'white', borderTopWidth: 1, borderColor: '#e5e7eb' },
  total: { fontSize: 15, marginBottom: 8, textAlign: 'center', color: '#374151' },
});
