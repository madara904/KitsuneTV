import React, { useState } from 'react';
import { View } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Sidebar } from '../components/layout/Sidebar';
import { PlayerColumn } from '../components/player/PlayerColumn';
import { LiveScreen } from '../screens/LiveScreen';
import { MoviesScreen } from '../screens/MoviesScreen';
import { SeriesScreen } from '../screens/SeriesScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { MovieDetailScreen } from '../screens/MovieDetailScreen';
import { SeriesDetailScreen } from '../screens/SeriesDetailScreen';
import { MoviePlayerScreen } from '../screens/MoviePlayerScreen';
import { PlayerProvider, usePlayer } from '../context/PlayerContext';

const Stack = createNativeStackNavigator();

/** App UI (Sidebar + Stack). Not rendered when fullscreen so there is nothing for TV focus to escape to. */
function Layout({ isPlayerActive }: { isPlayerActive: boolean }) {
  return (
    <View className="flex-1 flex-row" style={{ minWidth: 0, backgroundColor: '#0e0e12' }}>
      {!isPlayerActive && <Sidebar />}
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
          <Stack.Screen name="Movies" component={MoviesScreen} />
          <Stack.Screen
            name="MovieDetail"
            component={MovieDetailScreen as React.ComponentType<any>}
          />
          <Stack.Screen
            name="MoviePlayer"
            component={MoviePlayerScreen as React.ComponentType<any>}
          />
          <Stack.Screen name="Series" component={SeriesScreen} />
          <Stack.Screen
            name="SeriesDetail"
            component={SeriesDetailScreen as React.ComponentType<any>}
          />
          <Stack.Screen name="Settings" component={SettingsScreen} />
        </Stack.Navigator>
      </View>
    </View>
  );
}

/** When fullscreen: only PlayerColumn is rendered (no Layout). Third column only when a live channel is selected. */
function RootLayout({ isPlayerActive }: { isPlayerActive: boolean }) {
  const { fullscreen, currentChannel } = usePlayer();
  return (
    <View className="flex-1 flex-row" style={{ backgroundColor: '#0e0e12' }}>
      {!fullscreen && <Layout isPlayerActive={isPlayerActive} />}
      {currentChannel != null && <PlayerColumn />}
    </View>
  );
}

export function AppNavigator() {
  const navigationRef = useNavigationContainerRef();
  const [activeRoute, setActiveRoute] = useState<string | null>(null);

  return (
    <NavigationContainer
      ref={navigationRef}
      onStateChange={() => {
        const current = navigationRef.getCurrentRoute();
        setActiveRoute(current?.name ?? null);
      }}
    >
      <PlayerProvider>
        <RootLayout isPlayerActive={activeRoute === 'MoviePlayer'} />
      </PlayerProvider>
    </NavigationContainer>
  );
}
