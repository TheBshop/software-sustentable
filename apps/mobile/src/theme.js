import { StyleSheet } from 'react-native';

export const C = {
  verde: '#2f7d32',
  verdeOscuro: '#1f5a23',
  verdeClaro: '#e8f5e9',
  fondo: '#f6f7f6',
  borde: '#d1d5db',
  texto: '#1f2937',
  gris: '#6b7280',
  rojo: '#c62828',
  rojoClaro: '#fdecea',
  sol: '#f59e0b',
  solClaro: '#fdf3d7',
  solTexto: '#7a5200',
  azulClaro: '#e3eff8',
  azul: '#1d5d8a',
};

export const ui = StyleSheet.create({
  input: { backgroundColor: 'white', borderWidth: 1, borderColor: C.borde, borderRadius: 8, padding: 12, fontSize: 16, color: C.texto },
  button: { backgroundColor: C.verde, borderRadius: 10, padding: 16, alignItems: 'center' },
  buttonText: { color: 'white', fontSize: 18, fontWeight: '700' },
  buttonSecondary: { backgroundColor: 'white', borderWidth: 1, borderColor: C.borde, borderRadius: 10, padding: 12, alignItems: 'center' },
  buttonSecondaryText: { color: C.texto, fontSize: 15, fontWeight: '600' },
  error: { color: C.rojo, fontSize: 14 },
  muted: { color: C.gris, fontSize: 13 },
  label: { fontSize: 15, fontWeight: '700', marginTop: 16, marginBottom: 8, color: '#374151' },
});
