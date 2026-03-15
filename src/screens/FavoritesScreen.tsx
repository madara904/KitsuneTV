import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { favoriteRepo } from '../db/repositories/favoriteRepo';
import { channelRepo } from '../db/repositories/channelRepo';
import { usePlayer } from '../context/PlayerContext';
import type { Channel } from '../lib/types';

export function FavoritesScreen() {
  const { setCurrentChannel } = usePlayer();
  const [channels, setChannels] = useState<Channel[]>([]);

  const load = useCallback(async () => {
    const favs = await favoriteRepo.all();
    const chs: Channel[] = [];
    for (const f of favs) {
      const ch = await channelRepo.get(f.channelId);
      if (ch) chs.push(ch);
    }
    setChannels(chs);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const removeFavorite = useCallback(async (channelId: string) => {
    await favoriteRepo.remove(channelId);
    await load();
  }, [load]);

  const openPlayer = useCallback((channel: Channel) => {
    setCurrentChannel(channel);
  }, [setCurrentChannel]);

  if (channels.length === 0) {
    return (
      <View className="flex-1 p-6 justify-center items-center" style={{ backgroundColor: '#0e0e12' }}>
        <MaterialCommunityIcons name="heart-outline" size={64} color="#6e6e7d" />
        <Text className="text-white text-lg mt-4">No favorites</Text>
        <Text className="text-zinc-400 text-center">Add channels from the Live list (long-press or heart icon).</Text>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: '#0e0e12' }}>
      <FlatList
        data={channels}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openPlayer(item)}
            className="flex-row items-center gap-4 py-3 px-4 rounded-xl border border-transparent"
            focusable
          >
            {item.logo ? (
              <Image source={{ uri: item.logo }} className="w-12 h-12 rounded-lg bg-surface-700" resizeMode="cover" />
            ) : (
              <View className="w-12 h-12 rounded-lg bg-surface-700 items-center justify-center">
                <MaterialCommunityIcons name="television" size={24} color="#6e6e7d" />
              </View>
            )}
            <View className="flex-1">
              <Text className="text-white text-base font-medium" numberOfLines={1}>
                {item.name}
              </Text>
            </View>
            <Pressable onPress={() => removeFavorite(item.id)} focusable hitSlop={8}>
              <MaterialCommunityIcons name="heart" size={24} color="#ec4899" />
            </Pressable>
          </Pressable>
        )}
      />
    </View>
  );
}
