import React, { useLayoutEffect, useState } from 'react';
import { View, Pressable, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { usePlayer } from '../../context/PlayerContext';

const navItems = [
  { name: 'Live', route: 'Live', icon: 'television' as const },
  { name: 'Movies', route: 'Movies', icon: 'movie-open-outline' as const },
  { name: 'Series', route: 'Series', icon: 'television-classic' as const },
  { name: 'Settings', route: 'Settings', icon: 'cog' as const },
] as const;

export function Sidebar() {
  const navigation = useNavigation<any>();
  const { fullscreen } = usePlayer();
  const state = navigation.getState();
  const currentRoute = state?.routes?.[state.index ?? 0]?.name ?? 'Live';
  const [focusedIndex, setFocusedIndex] = useState(0);

  // Sync highlight with active route when route changes (e.g. back button)
  useLayoutEffect(() => {
    const idx = navItems.findIndex((i) => i.route === currentRoute);
    if (idx >= 0) {
      setFocusedIndex(idx);
    }
  }, [currentRoute]);

  return (
    <View
      className="flex flex-col items-center w-[88px] min-w-[88px] border-r border-surface-700"
      style={{
        backgroundColor: '#14141a',
        paddingVertical: 24,
        gap: 32,
        left: -200,
        transform: [{ translateX: 200 }],
      }}
    >
      <View className="items-center justify-center w-14 h-14">
        <Image
          source={require('../../assets/kitsune.png')}
          resizeMode="contain"
          className="w-full h-full"
        />
      </View>
      <View className="flex-1 flex flex-col gap-2 px-3.5">
        {navItems.map((item, index) => {
          const isFocused = focusedIndex === index;
          return (
            <Pressable
              key={item.route}
              onPress={() => {
                setFocusedIndex(index);
                navigation.navigate(item.route);
              }}
              focusable={!fullscreen}
              hasTVPreferredFocus={index === 0}
              onFocus={() => setFocusedIndex(index)}
              className="items-center justify-center w-14 h-14 rounded-2xl border border-transparent active:scale-95"
              style={{
                backgroundColor: isFocused ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                borderWidth: 1,
              }}
            >
              <MaterialCommunityIcons
                name={item.icon}
                size={26}
                color={isFocused ? '#d8b4fe' : '#6e6e7d'}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
