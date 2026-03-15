import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import type { Provider } from '../../lib/types';

const focusStyle = (focused: boolean, danger = false) => ({
  borderWidth: focused ? 3 : 0,
  borderColor: danger ? '#f87171' : '#d8b4fe',
});

type Props = {
  provider: Provider;
  isSyncing: boolean;
  focusedKey: string | null;
  onEdit: () => void;
  onSync: () => void;
  onRemove: () => void;
  onFocus: (key: string) => void;
  onBlur: () => void;
};

export function ProviderListItem({
  provider,
  isSyncing,
  focusedKey,
  onEdit,
  onSync,
  onRemove,
  onFocus,
  onBlur,
}: Props) {
  const editKey = `edit-${provider.id}`;
  const syncKey = `sync-${provider.id}`;
  const removeKey = `remove-${provider.id}`;

  return (
    <View
      key={provider.id}
      className="flex-row items-center justify-between py-4 px-4 rounded-xl border border-surface-700 mb-2"
    >
      <View className="flex-1">
        <Text className="text-white font-medium">{provider.name}</Text>
        <Text className="text-zinc-400 text-sm">{provider.type}</Text>
        <Text numberOfLines={1} className="text-zinc-500 text-xs">
          {provider.url}
        </Text>
      </View>

      <View className="flex-row gap-2">
        <Pressable
          onPress={onEdit}
          onFocus={() => onFocus(editKey)}
          onBlur={onBlur}
          focusable
          className="w-10 h-10 rounded-lg bg-surface-700 items-center justify-center"
          style={focusStyle(focusedKey === editKey)}
        >
          <MaterialCommunityIcons name="pencil" size={20} color="#d8b4fe" />
        </Pressable>

        <Pressable
          onPress={onSync}
          onFocus={() => onFocus(syncKey)}
          onBlur={onBlur}
          focusable
          disabled={isSyncing}
          className="w-10 h-10 rounded-lg bg-surface-700 items-center justify-center"
          style={focusStyle(focusedKey === syncKey)}
        >
          {isSyncing ? (
            <ActivityIndicator size="small" color="#8b5cf6" />
          ) : (
            <MaterialCommunityIcons name="sync" size={22} color="#d8b4fe" />
          )}
        </Pressable>

        <Pressable
          onPress={onRemove}
          onFocus={() => onFocus(removeKey)}
          onBlur={onBlur}
          focusable
          className="w-10 h-10 rounded-lg bg-red-500/20 items-center justify-center"
          style={focusStyle(focusedKey === removeKey, true)}
        >
          <MaterialCommunityIcons name="delete-outline" size={22} color="#f87171" />
        </Pressable>
      </View>
    </View>
  );
}
