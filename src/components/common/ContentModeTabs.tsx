import React from 'react';
import { findNodeHandle, Pressable, Text, View } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

export type ContentMode = 'all' | 'favorites' | 'recent';

const tabs: Array<{ key: ContentMode; label: string; icon: 'view-list' | 'heart' | 'clock-outline' }> =
  [
    { key: 'all', label: 'All', icon: 'view-list' },
    { key: 'favorites', label: 'Favorites', icon: 'heart' },
    { key: 'recent', label: 'Recent', icon: 'clock-outline' },
  ];

export function ContentModeTabs({
  mode,
  focusedKey,
  fullscreen = false,
  onFocusKey,
  onBlurKey,
  onSelect,
  onTabHandle,
}: {
  mode: ContentMode;
  focusedKey: string | null;
  fullscreen?: boolean;
  onFocusKey: (k: string) => void;
  onBlurKey: () => void;
  onSelect: (mode: ContentMode) => void;
  onTabHandle?: (mode: ContentMode, handle: number | null) => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#272732',
      }}
    >
      {tabs.map((tab) => {
        const focusKey = `mode-${tab.key}`;
        const isFocused = focusedKey === focusKey;
        const isActive = mode === tab.key;
        return (
          <Pressable
            key={tab.key}
            ref={(node) => onTabHandle?.(tab.key, node ? findNodeHandle(node) : null)}
            onPress={() => onSelect(tab.key)}
            onFocus={() => onFocusKey(focusKey)}
            onBlur={onBlurKey}
            focusable={!fullscreen}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: isFocused ? 3 : 1,
              borderColor: isFocused ? '#d8b4fe' : '#3f3f46',
              backgroundColor: isActive ? 'rgba(139, 92, 246, 0.25)' : 'transparent',
            }}
          >
            <MaterialCommunityIcons
              name={tab.icon}
              size={15}
              color={isActive ? '#e9d5ff' : '#9ca3af'}
            />
            <Text className="text-white text-xs">{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

