import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { providerService } from '../services/providerService';
import { mediaService } from '../services/mediaService';
import { mediaCollectionRepo } from '../db/repositories/mediaCollectionRepo';
import { EmptyState } from '../components/common/EmptyState';
import { ContentModeTabs, type ContentMode } from '../components/common/ContentModeTabs';
import type { Category, Movie } from '../lib/types';

export function MoviesScreen() {
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [allItems, setAllItems] = useState<Movie[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<ContentMode>('all');
  const [focusedKey, setFocusedKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    const list = await providerService.list();
    const providerId = selectedProviderId ?? list[0]?.id ?? null;
    setSelectedProviderId(providerId);
    if (!providerId) return;

    const [cats, items, favIds, recIds] = await Promise.all([
      mediaService.getMovieCategories(providerId),
      mediaService.getMovies(providerId, selectedCategoryId ?? undefined),
      mediaCollectionRepo.favoriteIds('movie'),
      mediaCollectionRepo.recentIds('movie', 50),
    ]);
    setCategories(cats);
    setAllItems(items);
    setFavoriteIds(new Set(favIds));
    setRecentIds(recIds);
  }, [selectedProviderId, selectedCategoryId]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));
  useEffect(() => {
    if (selectedProviderId) load();
  }, [selectedProviderId, selectedCategoryId, load]);

  const baseItems = useMemo(() => {
    if (mode === 'favorites') return allItems.filter((m) => favoriteIds.has(m.id));
    if (mode === 'recent') {
      const map = new Map(allItems.map((i) => [i.id, i]));
      return recentIds.map((id) => map.get(id)).filter((v): v is Movie => !!v);
    }
    return allItems;
  }, [mode, allItems, favoriteIds, recentIds]);

  const displayItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return baseItems;
    return baseItems.filter((i) => i.name.toLowerCase().includes(q));
  }, [baseItems, search]);

  const toggleFavorite = useCallback(async (id: string) => {
    const enabled = !favoriteIds.has(id);
    await mediaCollectionRepo.setFavorite('movie', id, enabled);
    const ids = await mediaCollectionRepo.favoriteIds('movie');
    setFavoriteIds(new Set(ids));
  }, [favoriteIds]);

  const openMovie = useCallback(async (id: string) => {
    await mediaCollectionRepo.markRecent('movie', id);
    const ids = await mediaCollectionRepo.recentIds('movie', 50);
    setRecentIds(ids);
    // TODO: navigate to movie player when implemented
  }, []);

  return (
    <View className="flex-1" style={{ backgroundColor: '#0e0e12' }}>
      <ContentModeTabs
        mode={mode}
        focusedKey={focusedKey}
        fullscreen={false}
        onFocusKey={setFocusedKey}
        onBlurKey={() => setFocusedKey(null)}
        onSelect={setMode}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginVertical: 10, height: 40, paddingHorizontal: 12, borderRadius: 10, borderWidth: focusedKey === 'movie-search' ? 3 : 1, borderColor: focusedKey === 'movie-search' ? '#d8b4fe' : '#3f3f46', backgroundColor: '#1c1c24' }}>
        <MaterialCommunityIcons name="magnify" size={18} color="#6e6e7d" />
        <TextInput
          className="flex-1 text-white text-sm p-0"
          placeholder="Movies suchen..."
          placeholderTextColor="#6e6e7d"
          value={search}
          onChangeText={setSearch}
          onFocus={() => setFocusedKey('movie-search')}
          onBlur={() => setFocusedKey(null)}
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
          renderItem={({ item }) => {
            const selected = (item.id === '__all__' && selectedCategoryId == null) || item.id === selectedCategoryId;
            return (
              <Pressable
                onPress={() => setSelectedCategoryId(item.id === '__all__' ? null : item.id)}
                focusable
                style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#3f3f46', backgroundColor: selected ? 'rgba(139,92,246,0.25)' : 'transparent' }}
              >
                <Text className="text-white text-xs">{item.name}</Text>
              </Pressable>
            );
          }}
        />
      )}

      {displayItems.length === 0 ? (
        <EmptyState
          iconName="movie-open-outline"
          title="No movies"
          description="Sync provider in Settings and mark favorites/recent with the top icons."
        />
      ) : (
        <FlatList
          data={displayItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => openMovie(item.id)}
              focusable
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1f1f2b' }}
            >
              <View style={{ width: 42, height: 42, borderRadius: 8, backgroundColor: '#272732', marginRight: 12, alignItems: 'center', justifyContent: 'center' }}>
                <MaterialCommunityIcons name="movie-open-outline" size={20} color="#8b8ba0" />
              </View>
              <Text className="text-white flex-1" numberOfLines={1}>{item.name}</Text>
              <Pressable onPress={() => toggleFavorite(item.id)} focusable style={{ padding: 8 }}>
                <MaterialCommunityIcons name={favoriteIds.has(item.id) ? 'heart' : 'heart-outline'} size={20} color={favoriteIds.has(item.id) ? '#ec4899' : '#8b8ba0'} />
              </Pressable>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
