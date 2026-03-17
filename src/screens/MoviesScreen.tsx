import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View, Image, Modal, TextInput } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { providerService } from '../services/providerService';
import { mediaService } from '../services/mediaService';
import { mediaCollectionRepo } from '../db/repositories/mediaCollectionRepo';
import { EmptyState } from '../components/common/EmptyState';
import { ContentModeTabs, type ContentMode } from '../components/common/ContentModeTabs';
import { SearchInputWithButton } from '../components/common/DebouncedSearchInput';
import type { Category, Movie } from '../lib/types';

const PAGE_SIZE = 40;
const ROW_HEIGHT = 67;


type MovieRowProps = {
  item: Movie;
  isFavorite: boolean;
  onOpen: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  isPreferredFocus: boolean;
};

const MovieRow = memo(function MovieRow({
  item,
  isFavorite,
  onOpen,
  onToggleFavorite,
  isPreferredFocus,
}: MovieRowProps) {
  const [isFocused, setIsFocused] = useState(false);
  const posterUri = (item.poster ?? '').trim() || null;

  return (
    <Pressable
      onPress={() => onOpen(item.id)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      focusable
      hasTVPreferredFocus={isPreferredFocus}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        marginVertical: 2,
        borderRadius: 10,
        backgroundColor: isFocused ? '#1b1b26' : 'transparent',
      }}
    >
      {posterUri ? (
        <Image
          source={{ uri: posterUri }}
          style={{ width: 42, height: 42, borderRadius: 8, marginRight: 12 }}
          resizeMode="cover"
        />
      ) : (
        <View style={{ width: 42, height: 42, borderRadius: 8, backgroundColor: '#272732', marginRight: 12, alignItems: 'center', justifyContent: 'center' }}>
          <MaterialCommunityIcons name="movie-open-outline" size={20} color="#8b8ba0" />
        </View>
      )}
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

const CategoryChip = memo(function CategoryChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      focusable
      className={`w-full py-3 px-4 rounded-xl items-center border-2 border-solid ${
        isFocused
          ? 'border-purple-300 bg-slate-700'
          : selected
          ? 'border-purple-600 bg-purple-900/40'
          : 'border-slate-700 bg-slate-800'
      }`}
    >
      <Text
        className={`text-sm text-center ${
          selected || isFocused ? 'text-white font-bold' : 'text-gray-300 font-medium'
        }`}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
});

const FilterButton = memo(function FilterButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      focusable
      className={`h-[46px] px-4 flex-row items-center rounded-xl border-2 border-solid ${
        isFocused ? 'bg-slate-700 border-purple-300' : 'bg-slate-900 border-slate-700'
      }`}
    >
      <MaterialCommunityIcons
        name="filter-variant"
        size={22}
        color={isFocused ? '#ffffff' : '#94a3b8'}
      />
      <Text
        numberOfLines={1}
        className={isFocused ? 'font-semibold text-white ml-2' : 'font-semibold text-slate-300 ml-2'}
      >
        {label}
      </Text>
    </Pressable>
  );
});

type CategoryModalProps = {
  visible: boolean;
  categories: Pick<Category, 'id' | 'name'>[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
};

const CategoryModal = memo(function CategoryModal({
  visible,
  categories,
  selectedId,
  onSelect,
  onClose,
}: CategoryModalProps) {

  const [search, setSearch] = useState('');

  const allOptions = useMemo(
    () => [{ id: '__all__', name: 'Alle Kategorien' }, ...categories],
    [categories],
  );

  const filteredOptions = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return allOptions;
    return allOptions.filter((item) => (item.name ?? '').toLowerCase().includes(value));
  }, [allOptions, search]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-center items-center bg-black/85 p-10">
        <View className="w-full max-w-[800px] max-h-[80%] bg-slate-950 rounded-3xl p-8 border border-slate-800">
          <Text className="text-white text-2xl font-bold mb-6 text-center">Kategorie wählen</Text>

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Kategorien durchsuchen..."
            placeholderTextColor="#64748b"
            className="mb-4 px-4 py-3 rounded-xl bg-slate-900 text-slate-100 border border-slate-700"
          />

          <FlatList
            data={filteredOptions}
            keyExtractor={(item) => item.id ?? 'all'}
            numColumns={3}
            columnWrapperStyle={{ gap: 12, marginBottom: 12 }}
            renderItem={({ item }) => (
              <View className="flex-1">
                <CategoryChip
                  label={item.name}
                  selected={item.id === '__all__' ? selectedId === null : selectedId === item.id}
                  onPress={() => { onSelect(item.id === '__all__' ? null : item.id); onClose(); }}
                />
              </View>
            )}
          />
          <Pressable onPress={onClose} className="mt-6 py-4 bg-slate-800 rounded-xl items-center border border-slate-700 active:bg-slate-600">
            <Text className="text-gray-300 font-bold">Abbrechen</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
});

export function MoviesScreen() {
  const [isCatModalVisible, setIsCatModalVisible] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [items, setItems] = useState<Movie[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<ContentMode>('all');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const navigation = useNavigation();
  const [lastOpenedMovieId, setLastOpenedMovieId] = useState<string | null>(null);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const fetchPage = useCallback(async (providerId: string, pageOffset: number) => {
    if (mode === 'favorites') {
      const favIds = await mediaCollectionRepo.favoriteIds('movie');
      const pageIds = favIds.slice(pageOffset, pageOffset + PAGE_SIZE);
      const rows = await mediaService.getMoviesByIds(pageIds);
      return { rows, totalLike: favIds.length };
    }
    if (mode === 'recent') {
      const recIds = await mediaCollectionRepo.recentIds('movie', 500);
      const pageIds = recIds.slice(pageOffset, pageOffset + PAGE_SIZE);
      const rows = await mediaService.getMoviesByIds(pageIds);
      return { rows, totalLike: recIds.length };
    }
    if (query.length >= 2) {
      const rows = await mediaService.searchMovies(providerId, query, PAGE_SIZE, pageOffset, selectedCategoryId ?? undefined);
      return { rows, totalLike: pageOffset + rows.length + (rows.length === PAGE_SIZE ? 1 : 0) };
    }
    const rows = await mediaService.getMovies(providerId, selectedCategoryId ?? undefined, PAGE_SIZE, pageOffset);
    return { rows, totalLike: pageOffset + rows.length + (rows.length === PAGE_SIZE ? 1 : 0) };
  }, [mode, query, selectedCategoryId]);

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    try {
      const list = await providerService.list();
      const providerId = selectedProviderId ?? list[0]?.id ?? null;
      setSelectedProviderId(providerId);
      if (!providerId) return;
      const [cats, favIds, page] = await Promise.all([
        mediaService.getMovieCategories(providerId),
        mediaCollectionRepo.favoriteIds('movie'),
        fetchPage(providerId, 0),
      ]);
      setCategories(cats);
      setFavoriteIds(new Set(favIds));
      setItems(page.rows);
      setOffset(page.rows.length);
      setHasMore(page.rows.length === PAGE_SIZE);
    } finally {
      setLoading(false);
    }
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

  useFocusEffect(useCallback(() => {
    if (!initialLoaded) loadFirstPage().then(() => setInitialLoaded(true));
  }, [initialLoaded, loadFirstPage]));

  useEffect(() => {
    if (selectedProviderId) loadFirstPage();
  }, [selectedProviderId, selectedCategoryId, mode, query, loadFirstPage]);

  const toggleFavorite = useCallback(async (id: string) => {
    const enabled = !favoriteIds.has(id);
    await mediaCollectionRepo.setFavorite('movie', id, enabled);
    const ids = await mediaCollectionRepo.favoriteIds('movie');
    setFavoriteIds(new Set(ids));
  }, [favoriteIds]);

  const openMovie = useCallback((id: string) => {
    setLastOpenedMovieId(id);
    // @ts-expect-error
    navigation.navigate('MovieDetail', { movieId: id });
  }, [navigation]);

  const renderItem = useCallback(({ item }: { item: Movie }) => (
    <MovieRow item={item} isFavorite={favoriteIds.has(item.id)} onOpen={openMovie} onToggleFavorite={toggleFavorite} isPreferredFocus={lastOpenedMovieId === item.id} />
  ), [favoriteIds, openMovie, toggleFavorite, lastOpenedMovieId]);

  const currentCatName = categories.find((c) => c.id === selectedCategoryId)?.name || 'Alle Kategorien';

  return (
    <View className="flex-1 bg-[#0e0e12]">
      <ContentModeTabs mode={mode} fullscreen={false} onSelect={setMode} />

      <View className="flex-row items-center px-4 py-2 gap-x-3">
        <View className="flex-1">
          <SearchInputWithButton placeholder="Movies suchen..." onSubmit={setQuery} />
        </View>

        {mode === 'all' && (
          <FilterButton
            label={currentCatName}
            onPress={() => setIsCatModalVisible(true)}
          />
        )}
      </View>

      <CategoryModal
        visible={isCatModalVisible}
        categories={categories}
        selectedId={selectedCategoryId}
        onClose={() => setIsCatModalVisible(false)}
        onSelect={(id: string | null) => setSelectedCategoryId(id)}
      />

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#a78bfa" />
        </View>
      ) : items.length === 0 ? (
        <EmptyState iconName="movie-open-outline" title="No movies" description="Sync provider in Settings." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }}
          getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator color="#a78bfa" className="my-2" /> : null}
          renderItem={renderItem}
        />
      )}
    </View>
  );
}