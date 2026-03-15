import React, { useRef, useEffect, useState } from 'react';
import { View, Pressable, Image, findNodeHandle } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const navItems = [
  { name: 'Live', route: 'Live', icon: 'television' as const },
  { name: 'Favs', route: 'Favorites', icon: 'heart' as const },
  { name: 'Recent', route: 'Recent', icon: 'clock-outline' as const },
  { name: 'Settings', route: 'Settings', icon: 'cog' as const },
] as const;

/** Android TV focus: nextFocusDown/Up need native node handles (see Norigin Media focus nav article) */
type TVFocusProps = { nextFocusDown?: number; nextFocusUp?: number };

export function Sidebar() {
  const navigation = useNavigation<any>();
  const state = navigation.getState();
  const currentRoute = state?.routes?.[state.index ?? 0]?.name ?? 'Live';
  const refs = useRef<(React.ElementRef<typeof Pressable> | null)[]>([]);
  const [focusHandles, setFocusHandles] = useState<number[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(0);

  // Resolve native node handles (Android TV nextFocusDown/Up) and sync focusedIndex with route
  useEffect(() => {
    const handles = refs.current
      .map((r) => (r != null ? findNodeHandle(r) : null))
      .filter((h): h is number => h != null);
    if (handles.length === navItems.length) {
      setFocusHandles(handles);
    }
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
        // Norigin: move sidebar "off" layout so Android focus doesn't jump to content
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
          const tvFocus: TVFocusProps = {
            nextFocusDown: focusHandles[index + 1],
            nextFocusUp: focusHandles[index - 1],
          };
          return (
            <Pressable
              key={item.route}
              ref={(r) => { refs.current[index] = r; }}
              onPress={() => navigation.navigate(item.route)}
              focusable={true}
              hasTVPreferredFocus={index === 0}
              {...(tvFocus as object)}
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
