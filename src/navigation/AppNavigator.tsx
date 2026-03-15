import React from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Sidebar } from '../components/layout/Sidebar';
import { PlayerColumn } from '../components/player/PlayerColumn';
import { LiveScreen } from '../screens/LiveScreen';
import { FavoritesScreen } from '../screens/FavoritesScreen';
import { RecentScreen } from '../screens/RecentScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { PlayerProvider, usePlayer } from '../context/PlayerContext';

const Stack = createNativeStackNavigator();

/** App UI (Sidebar + Stack). Not rendered when fullscreen so there is nothing for TV focus to escape to. */
function Layout() {
  return (
    <View className="flex-1 flex-row" style={{ minWidth: 0, backgroundColor: '#0e0e12' }}>
      <Sidebar />
      <View className="flex-1" style={{ minWidth: 0 }}>
        <Stack.Navigator
          initialRouteName="Live"
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#0e0e12' },
            animation: 'none',
          }}
        >
          <Stack.Screen name="Live" component={LiveScreen} />
          <Stack.Screen name="Favorites" component={FavoritesScreen} />
          <Stack.Screen name="Recent" component={RecentScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
        </Stack.Navigator>
      </View>
    </View>
  );
}

/** When fullscreen: only PlayerColumn is rendered (no Layout). Third column only when a channel is selected. */
function RootLayout() {
  const { fullscreen, currentChannel } = usePlayer();
  return (
    <View className="flex-1 flex-row" style={{ backgroundColor: '#0e0e12' }}>
      {!fullscreen && <Layout />}
      {currentChannel != null && <PlayerColumn />}
    </View>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer>
      <PlayerProvider>
        <RootLayout />
      </PlayerProvider>
    </NavigationContainer>
  );
}
