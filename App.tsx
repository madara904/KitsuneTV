/**
 * Kitsune TV - IPTV Player for Android TV
 * @format
 */

import './global.css';

import React, { useEffect, useState } from 'react';
import { StatusBar, View, ActivityIndicator, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initDatabase } from './src/db';
import { AppNavigator } from './src/navigation/AppNavigator';

function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Startup timeout. Try restarting the app.')), 15000)
    );
    Promise.race([initDatabase(), timeout])
      .then(() => setReady(true))
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0e0e12', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ color: '#ef4444', marginBottom: 8 }}>DB init failed</Text>
        <Text style={{ color: '#94a3b8' }}>{error}</Text>
      </View>
    );
  }
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0e0e12', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#8b5cf6" />
      </View>
    );
  }
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#0e0e12" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}

export default App;
