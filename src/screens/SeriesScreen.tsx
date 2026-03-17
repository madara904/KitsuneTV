import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { providerService } from '../services/providerService';
import { mediaService } from '../services/mediaService';
import { mediaCollectionRepo } from '../db/repositories/mediaCollectionRepo';
import { EmptyState } from '../components/common/EmptyState';
import { ContentModeTabs, type ContentMode } from '../components/common/ContentModeTabs';
import type { Category, SeriesItem } from '../lib/types';

const PAGE_SIZE = 40;
const ROW_HEIGHT = 67;

type SeriesRowProps = {
  item: SeriesItem;
  isFavorite: boolean;
  onOpen: (id: string) => void;
  onToggleFavorite: (id: string) => void;
};

const SeriesRow = memo(function SeriesRow({ item, isFavorite, onOpen, onToggleFavorite }: SeriesRowProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      onPress={() => onOpen(item.id)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      focusable
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        marginVertical: 2,
        borderWidth: isFocused ? 2 : 1,
        borderColor: isFocused ? '#d8b4fe' : '#1f1f2b',
        borderRadius: 10,
        backgroundColor: isFocused ? '#1b1b26' : 'transparent',
      }}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 8,
          backgroundColor: '#272732',
          marginRight: 12,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MaterialCommunityIcons name="television-classic" size={20} color="#8b8ba0" />
      </View>
      <Text className="text-white flex-1" numberOfLines={1}>
        {item.name}
      </Text>
      <Pressable onPress={() => onToggleFavorite(item.id)} focusable={false} style={{ padding: 8 }}>
        <MaterialCommunityIcons
          name={isFavorite ? 'heart' : 'heart-outline'}
          size={20}
          color={isFavorite ? '#ec4899' : '#8b8ba0'}
        />
      </Pressable>
    </Pressable>
  );
});

export function SeriesScreen() {
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [items, setItems] = useState<SeriesItem[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<ContentMode>('all');
  const [searchFocused, setSearchFocused] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const query = useMemo(() => search.trim(), [search]);

  const fetchPage = useCallback(
    async (providerId: string, pageOffset: number) => {
      if (mode === 'favorites') {
        const favIds = await mediaCollectionRepo.favoriteIds('series');
        const pageIds = favIds.slice(pageOffset, pageOffset + PAGE_SIZE);
        const rows = await mediaService.getSeriesByIds(pageIds);
        return { rows };
      }
      if (mode === 'recent') {
        const recIds = await mediaCollectionRepo.recentIds('series', 500);
        const pageIds = recIds.slice(pageOffset, pageOffset + PAGE_SIZE);
        const rows = await mediaService.getSeriesByIds(pageIds);
        return { rows };
      }

      if (query.length >= 2) {
        const rows = await mediaService.searchSeries(
          providerId,
          query,
          PAGE_SIZE,
          pageOffset,
          selectedCategoryId ?? undefined,
        );
        return { rows };
      }

      const rows = await mediaService.getSeries(
        providerId,
        selectedCategoryId ?? undefined,
        PAGE_SIZE,
        pageOffset,
      );
      return { rows };
    },
    [mode, query, selectedCategoryId],
  );

  const loadFirstPage = useCallback(async () => {
    const list = await providerService.list();
    const providerId = selectedProviderId ?? list[0]?.id ?? null;
    setSelectedProviderId(providerId);
    if (!providerId) return;

    const [cats, favIds, page] = await Promise.all([
      mediaService.getSeriesCategories(providerId),
      mediaCollectionRepo.favoriteIds('series'),
      fetchPage(providerId, 0),
    ]);

    setCategories(cats);
    setFavoriteIds(new Set(favIds));
    setItems(page.rows);
    setOffset(page.rows.length);
    setHasMore(page.rows.length === PAGE_SIZE);
  }, [selectedProviderId, fetchPage]);

  const loadMore = useCallback(async () => {
    if (!selectedProviderId || !hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchPage(selectedProviderId, offset);
      setItems((prev) => [...prev, ...page.rows]);
      setOffset((v) => v + page.rows.length);
      setHasMore(page.rows.length === PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }, [selectedProviderId, hasMore, loadingMore, fetchPage, offset]);

  useFocusEffect(
    useCallback(() => {
      loadFirstPage();
    }, [loadFirstPage]),
  );

  useEffect(() => {
    if (selectedProviderId) loadFirstPage();
  }, [selectedProviderId, selectedCategoryId, mode, query, loadFirstPage]);

  const toggleFavorite = useCallback(
    async (id: string) => {
      const enabled = !favoriteIds.has(id);
      await mediaCollectionRepo.setFavorite('series', id, enabled);
      const ids = await mediaCollectionRepo.favoriteIds('series');
      setFavoriteIds(new Set(ids));
    },
    [favoriteIds],
  );

  const openSeries = useCallback(async (id: string) => {
    await mediaCollectionRepo.markRecent('series', id);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: SeriesItem }) => (
      <SeriesRow
        item={item}
        isFavorite={favoriteIds.has(item.id)}
        onOpen={openSeries}
        onToggleFavorite={toggleFavorite}
      />
    ),
    [favoriteIds, openSeries, toggleFavorite],
  );

  return (
    <View className="flex-1" style={{ backgroundColor: '#0e0e12' }}>
      <ContentModeTabs mode={mode} fullscreen={false} onSelect={setMode} />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          marginHorizontal: 16,
          marginVertical: 10,
          height: 40,
          paddingHorizontal: 12,
          borderRadius: 10,
          borderWidth: searchFocused ? 3 : 1,
          borderColor: searchFocused ? '#d8b4fe' : '#3f3f46',
          backgroundColor: '#1c1c24',
        }}
      >
        <MaterialCommunityIcons name="magnify" size={18} color="#6e6e7d" />
        <TextInput
          className="flex-1 text-white text-sm p-0"
          placeholder="Serien suchen..."
          placeholderTextColor="#6e6e7d"
          value={search}
          onChangeText={setSearch}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          focusable
          style={{ paddingVertical: 8, color: '#fff' }}
        />
      </View>

      {categories.length > 0 && mode === 'all' && (
        <FlatList
          horizontal
          data={[{ id: '__all__', name: 'All', providerId: selectedProviderId ?? '' }, ...categories]}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 10, gap: 8 }}
          renderItem={({ item, index }) => {
            const selected =
              (item.id === '__all__' && selectedCategoryId == null) || item.id === selectedCategoryId;
            const rawName = (item.name ?? '').trim();
            const label =
              item.id === '__all__'
                ? 'Alle Serien'
                : rawName.length > 0
                ? rawName
                : `Kategorie ${index}`;
            const textColor = '#ffffff';
            const chipBackground = selected ? '#7c3aed' : '#111827';
            return (
              <Pressable
                onPress={() => setSelectedCategoryId(item.id === '__all__' ? null : item.id)}
                focusable
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 999,
                  borderWidth: 1.5,
                  borderColor: selected ? '#a855f7' : '#3f3f46',
                  backgroundColor: chipBackground,
                }}
              >
                <Text style={{ color: textColor, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
                  {label}
                </Text>
              </Pressable>
            );
          }}
        />
      )}

      {items.length === 0 ? (
        <EmptyState
          iconName="television-classic"
          title="No series"
          description="Sync provider in Settings and mark favorites/recent with the top icons."
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={3}
          removeClippedSubviews
          updateCellsBatchingPeriod={16}
          getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color="#a78bfa" style={{ marginVertical: 10 }} /> : null
          }
          renderItem={renderItem}
        />
      )}
    </View>
  );
}
