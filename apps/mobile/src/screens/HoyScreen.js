import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, Image, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import { getHojaDeRuta } from '../api';
import { enqueueVisita, onQueueChange } from '../offline/syncQueue';
import { C, ui } from '../theme';

const MOTIVOS = {
  cerrado: 'Cerrado / no atendieron',
  sin_material: 'No había material',
  material_mezclado: 'Material mezclado con basura',
  acceso_bloqueado: 'Acceso bloqueado',
  falta_tiempo: 'No llegué hoy',
  otro: 'Otro',
};

/**
 * Hoja de ruta del día: los pedidos programados, en el orden sugerido por cercanía.
 * En cada parada: registrar el retiro o informar por qué no se pudo (con foto).
 * Funciona sin señal: la lista queda guardada y las visitas se envían después.
 */
export default function HoyScreen({ onRegistrar, notify, refreshKey }) {
  const [hoja, setHoja] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [abierta, setAbierta] = useState(null); // parada en la que se informa "no se pudo"
  const [motivo, setMotivo] = useState(null);
  const [foto, setFoto] = useState(null);
  const [cola, setCola] = useState({ pending: [], visitas: [] });

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setHoja(await getHojaDeRuta());
    } finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar, refreshKey]);
  useEffect(() => onQueueChange(setCola), []);

  // Lo que ya se hizo en el teléfono y todavía no llegó al servidor
  const hechoLocal = (id) => cola.pending.some((p) => p.solicitud === id) ? 'retirado' : cola.visitas?.some((v) => v.solicitud === id) ? 'no_realizado' : null;

  async function sacarFoto() {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      const r = perm.granted ? await ImagePicker.launchCameraAsync({ quality: 0.5 }) : await ImagePicker.launchImageLibraryAsync({ quality: 0.5 });
      if (!r.canceled) setFoto(r.assets[0].uri);
    } catch {
      notify('No se pudo abrir la cámara.');
    }
  }

  async function informar(p) {
    if (!motivo) return notify('Elegí el motivo.');
    await enqueueVisita({ localId: Crypto.randomUUID(), solicitud: p.id, motivo, foto, clienteNombre: p.cliente.razonSocial });
    // Se marca enseguida: si ya se envió, la cola queda vacía y la parada no puede salir de ahí
    setHoja((h) => ({ ...h, paradas: h.paradas.map((x) => (x.id === p.id ? { ...x, estado: 'no_realizada', resultado: { motivo, motivoTexto: MOTIVOS[motivo] } } : x)) }));
    notify(`Visita informada · ${p.cliente.razonSocial}`);
    setAbierta(null);
    setMotivo(null);
    setFoto(null);
  }

  const paradas = hoja?.paradas ?? [];
  const pendientes = paradas.filter((p) => p.estado === 'programada' && !hechoLocal(p.id)).length;

  return (
    <ScrollView contentContainerStyle={s.body} refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} />}>
      <Text style={s.resumen}>
        {hoja ? `${pendientes} de ${paradas.length} parada${paradas.length === 1 ? '' : 's'} por hacer` : 'Cargando…'}
        {hoja?.kmEstimados ? ` · ~${hoja.kmEstimados} km` : ''}
      </Text>
      {hoja?.sinConexion && <Text style={[ui.muted, s.aviso]}>Sin señal: es la hoja guardada{hoja.guardada ? ` (${new Date(hoja.guardada).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })})` : ''}.</Text>}
      {hoja && !paradas.length && <Text style={ui.muted}>No hay retiros programados para hoy. Deslizá hacia abajo para actualizar.</Text>}

      {paradas.map((p, i) => {
        const local = hechoLocal(p.id);
        const hecha = p.estado !== 'programada' || local;
        return (
          <View key={p.id} style={[s.parada, hecha && s.paradaHecha]}>
            <View style={s.fila}>
              <Text style={[s.numero, hecha && { backgroundColor: C.gris }]}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.cliente}>{p.cliente.razonSocial}</Text>
                <Text style={ui.muted}>{p.sede ?? 'Sin dirección'}</Text>
                {p.detalle ? <Text style={s.detalle}>{p.detalle}{p.kgEstimados ? ` · ~${p.kgEstimados} kg` : ''}</Text> : null}
                {p.estado === 'realizada' || local === 'retirado' ? <Text style={s.ok}>✓ Retirado{local ? ' (sin enviar)' : ''}</Text> : null}
                {p.estado === 'no_realizada' || local === 'no_realizado' ? <Text style={s.mal}>No se pudo{p.resultado?.motivoTexto ? `: ${p.resultado.motivoTexto}` : ''}{local ? ' (sin enviar)' : ''}</Text> : null}
              </View>
            </View>
            {!hecha && abierta !== p.id && (
              <View style={s.botones}>
                <TouchableOpacity style={[ui.button, { flex: 1 }]} onPress={() => onRegistrar(p)} accessibilityRole="button">
                  <Text style={ui.buttonText}>Registrar retiro</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.secundario} onPress={() => { setAbierta(p.id); setMotivo(null); setFoto(null); }} accessibilityRole="button">
                  <Text style={s.secundarioTexto}>No se pudo</Text>
                </TouchableOpacity>
              </View>
            )}
            {abierta === p.id && (
              <View style={{ gap: 6, marginTop: 8 }}>
                {Object.entries(MOTIVOS).map(([k, v]) => (
                  <TouchableOpacity key={k} style={[s.motivo, motivo === k && s.motivoSel]} onPress={() => setMotivo(k)} accessibilityRole="radio" accessibilityState={{ selected: motivo === k }}>
                    <Text style={[s.motivoTexto, motivo === k && { color: C.verde, fontWeight: '700' }]}>{v}</Text>
                  </TouchableOpacity>
                ))}
                <View style={s.fila}>
                  {foto ? <Image source={{ uri: foto }} style={s.foto} /> : null}
                  <TouchableOpacity style={s.secundario} onPress={sacarFoto} accessibilityRole="button">
                    <Text style={s.secundarioTexto}>{foto ? 'Cambiar foto' : 'Sacar foto (opcional)'}</Text>
                  </TouchableOpacity>
                </View>
                <View style={s.botones}>
                  <TouchableOpacity style={[ui.button, { flex: 1 }]} onPress={() => informar(p)} accessibilityRole="button">
                    <Text style={ui.buttonText}>Informar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.secundario} onPress={() => setAbierta(null)} accessibilityRole="button">
                    <Text style={s.secundarioTexto}>Volver</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  body: { padding: 16, paddingBottom: 40, gap: 10 },
  resumen: { fontSize: 16, fontWeight: '700', color: C.texto },
  aviso: { backgroundColor: '#fdf3d7', padding: 8, borderRadius: 8 },
  parada: { backgroundColor: 'white', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  paradaHecha: { opacity: 0.7 },
  fila: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  numero: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.verde, color: 'white', textAlign: 'center', lineHeight: 28, fontWeight: '700', overflow: 'hidden' },
  cliente: { fontSize: 17, fontWeight: '700', color: C.texto },
  detalle: { fontSize: 14, color: C.texto, marginTop: 2 },
  ok: { color: C.verde, fontWeight: '700', marginTop: 4 },
  mal: { color: C.rojo, fontWeight: '700', marginTop: 4 },
  botones: { flexDirection: 'row', gap: 8, marginTop: 10 },
  secundario: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: C.borde, alignItems: 'center', justifyContent: 'center' },
  secundarioTexto: { fontSize: 15, color: C.texto, fontWeight: '600' },
  motivo: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: C.borde },
  motivoSel: { borderColor: C.verde, backgroundColor: C.verdeClaro },
  motivoTexto: { fontSize: 15, color: C.texto },
  foto: { width: 56, height: 56, borderRadius: 8 },
});
