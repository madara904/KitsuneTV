import React, { useCallback, useState } from 'react';
import { View, FlatList } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { recentRepo } from '../db/repositories/recentRepo';
import { channelRepo } from '../db/repositories/channelRepo';
import { usePlayer } from '../context/PlayerContext';
import type { Channel } from '../lib/types';
import { ChannelListItem } from '../components/channel/ChannelListItem';
import { EmptyState } from '../components/common/EmptyState';

const RECENT_LIMIT = 50;

export function RecentScreen() {
  const { setCurrentChannel } = usePlayer();
  const [channels, setChannels] = useState<Channel[]>([]);

  const load = useCallback(async () => {
    const recents = await recentRepo.list(RECENT_LIMIT);
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const r of recents) {
      if (seen.has(r.channelId)) continue;
      seen.add(r.channelId);
    }
    ids.push(...seen);
    const chs = await channelRepo.getMany(ids);
    setChannels(chs);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openPlayer = useCallback((channel: Channel) => {
    setCurrentChannel(channel);
  }, [setCurrentChannel]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [focusedId, setFocusedId] = useState<string | null>(null);

  if (channels.length === 0) {
    return (
      <EmptyState
        iconName="clock-outline"
        title="No recent channels"
        description="Play channels from Live or Favorites to see them here."
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
            focusable
          />
        )}
      />
    </View>
  );
}
