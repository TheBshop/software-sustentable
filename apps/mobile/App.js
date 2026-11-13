import { useEffect } from 'react';
import { SafeAreaView, StatusBar } from 'react-native';
import NuevoRetiroScreen from './src/screens/NuevoRetiroScreen';
import { startAutoSync } from './src/offline/syncQueue';

// MVP: una sola pantalla. Próximos sprints: login, "Mis retiros del día", detalle de retiro.
// (Ahí conviene sumar expo-router para la navegación.)
export default function App() {
  useEffect(() => startAutoSync(), []);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f6f7f6' }}>
      <StatusBar barStyle="light-content" backgroundColor="#2f7d32" />
      <NuevoRetiroScreen />
    </SafeAreaView>
  );
}
