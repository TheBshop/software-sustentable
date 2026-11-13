import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { login } from '../api';
import { C, ui } from '../theme';

/** El chofer ingresa una sola vez; después la sesión queda guardada 30 días. */
export default function LoginScreen({ onLogin, aviso }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email.trim() || !password) return setError('Completá email y contraseña.');
    setError(null);
    setLoading(true);
    try {
      onLogin(await login(email, password));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={s.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.brand}>
        <Text style={s.logo}>♻</Text>
        <Text style={s.title}>Nueva Vida</Text>
        <Text style={s.subtitle}>Registro de retiros</Text>
      </View>
      {aviso && <Text style={s.aviso}>{aviso}</Text>}
      <View style={{ gap: 12 }}>
        <TextInput
          style={ui.input}
          placeholder="Email"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          accessibilityLabel="Email"
        />
        <TextInput
          style={ui.input}
          placeholder="Contraseña"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={submit}
          accessibilityLabel="Contraseña"
        />
        {error && <Text style={ui.error} accessibilityRole="alert">{error}</Text>}
        <TouchableOpacity style={[ui.button, loading && { opacity: 0.6 }]} onPress={submit} disabled={loading} accessibilityRole="button">
          {loading ? <ActivityIndicator color="white" /> : <Text style={ui.buttonText}>Ingresar</Text>}
        </TouchableOpacity>
      </View>
      <Text style={[ui.muted, { textAlign: 'center', marginTop: 24 }]}>¿No tenés usuario? Pedíselo a administración.</Text>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: C.fondo },
  brand: { alignItems: 'center', marginBottom: 32 },
  logo: { fontSize: 48, color: C.verde },
  title: { fontSize: 28, fontWeight: '800', color: C.verdeOscuro },
  subtitle: { fontSize: 16, color: C.gris },
  aviso: { backgroundColor: C.solClaro, color: C.solTexto, padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 14 },
});
