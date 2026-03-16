import React, { useCallback, useState } from 'react';
import { View, FlatList } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { favoriteRepo } from '../db/repositories/favoriteRepo';
import { channelRepo } from '../db/repositories/channelRepo';
import { usePlayer } from '../context/PlayerContext';
import type { Channel } from '../lib/types';
import { ChannelListItem } from '../components/channel/ChannelListItem';
import { EmptyState } from '../components/common/EmptyState';

export function FavoritesScreen() {
  const { setCurrentChannel } = usePlayer();
  const [channels, setChannels] = useState<Channel[]>([]);

  const load = useCallback(async () => {
    const favs = await favoriteRepo.all();
    const ids = favs.map((f) => f.channelId);
    const chs = await channelRepo.getMany(ids);
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

  const [focusedId, setFocusedId] = useState<string | null>(null);

  if (channels.length === 0) {
    return (
      <EmptyState
        iconName="heart-outline"
        title="No favorites"
        description="Add channels from the Live list (long-press or heart icon)."
      />
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: '#0e0e12' }}>
      <FlatList
        data={channels}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        renderItem={({ item }) => (
          <ChannelListItem
            channel={item}
            isFocused={focusedId === item.id}
            isSecondaryFocused={false}
            isNowPlaying={false}
            onPress={openPlayer}
            onSecondaryPress={removeFavorite}
            focusable
          />
        )}
      />
    </View>
  );
}
