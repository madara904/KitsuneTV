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
import { PlayerProvider } from '../context/PlayerContext';

const Stack = createNativeStackNavigator();

function MainLayout() {
  return (
    <PlayerProvider>
      <View className="flex-1 flex-row" style={{ backgroundColor: '#0e0e12' }}>
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
        <PlayerColumn />
      </View>
    </PlayerProvider>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer>
      <MainLayout />
    </NavigationContainer>
  );
}
