import React, { memo, useCallback, useState } from 'react';
import { findNodeHandle, Pressable, Text, View, } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

export type ContentMode = 'all' | 'favorites' | 'recent';

const tabs: Array<{ key: ContentMode; label: string; icon: 'view-list' | 'heart' | 'clock-outline' }> = [
  { key: 'all', label: 'All', icon: 'view-list' },
  { key: 'favorites', label: 'Favorites', icon: 'heart' },
  { key: 'recent', label: 'Recent', icon: 'clock-outline' },
];

export const ContentModeTabs = memo(function ContentModeTabs({
  mode,
  fullscreen = false,
  onSelect,
  onTabHandle,
}: {
  mode: ContentMode;
  fullscreen?: boolean;
  onSelect: (mode: ContentMode) => void;
  onTabHandle?: (mode: ContentMode, handle: number | null) => void;
}) {
  const [focusedMode, setFocusedMode] = useState<ContentMode | null>(null);

  const handleBlur = useCallback(() => {
    setFocusedMode(null);
  }, []);

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
        const isFocused = focusedMode === tab.key;
        const isActive = mode === tab.key;
        return (
          <Pressable
            key={tab.key}
            ref={(node) => onTabHandle?.(tab.key, node ? findNodeHandle(node) : null)}
            onPress={() => onSelect(tab.key)}
            onFocus={() => setFocusedMode(tab.key)}
            onBlur={handleBlur}
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
              backgroundColor: isActive ? '#7c3aed' : '#111827',
            }}
          >
            <MaterialCommunityIcons
              name={tab.icon}
              size={15}
              color={isActive ? '#ffffff' : '#d1d5db'}
            />
            <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '600' }}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});
