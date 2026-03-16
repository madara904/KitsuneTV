import React, { useCallback, useEffect, useState, memo, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  Image,
  findNodeHandle,
  type ListRenderItemInfo,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { providerService } from '../services/providerService';
import { liveService } from '../services/liveService';
import { channelRepo } from '../db/repositories/channelRepo';
import { favoriteRepo } from '../db/repositories/favoriteRepo';
import { usePlayer } from '../context/PlayerContext';
import type { Provider, Channel, Category } from '../lib/types';

const SEARCH_DEBOUNCE_MS = 700;
const SEARCH_LIMIT = 50;
const MIN_SEARCH_LENGTH = 2;
const CHANNEL_ROW_HEIGHT = 60;
const CATEGORY_PILL_HEIGHT = 40;
const CATEGORY_ROW_HEIGHT = 44;
const CATEGORY_PICKER_MAX_HEIGHT = 320;

// Search input that only notifies parent after debounce – avoids re-rendering whole screen on every key
const DebouncedSearchInput = memo(function DebouncedSearchInput({
  placeholder,
  onSearchChange,
  minLength,
  debounceMs,
  isFocused,
  onFocusKey,
  onBlurKey,
  focusable = true,
}: {
  placeholder: string;
  onSearchChange: (query: string) => void;
  minLength: number;
  debounceMs: number;
  isFocused: boolean;
  onFocusKey: () => void;
  onBlurKey: () => void;
  focusable?: boolean;
}) {
  const [localValue, setLocalValue] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const t = localValue.trim();
    if (t.length < minLength) {
      onSearchChange('');
      return () => {};
    }
    const id = setTimeout(() => {
      onSearchChange(t);
    }, debounceMs);
    timerRef.current = id;
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [localValue, minLength, debounceMs, onSearchChange]);

  return (
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10, height: 40, paddingHorizontal: 12, borderRadius: 10, borderWidth: isFocused ? 3 : 1, borderColor: isFocused ? '#d8b4fe' : '#3f3f46', backgroundColor: '#1c1c24' }}>
      <MaterialCommunityIcons name="magnify" size={22} color="#6e6e7d" />
      <TextInput
        className="flex-1 text-white text-base p-0"
        placeholder={placeholder}
        placeholderTextColor="#6e6e7d"
        value={localValue}
        onChangeText={setLocalValue}
        onFocus={onFocusKey}
        onBlur={onBlurKey}
        focusable={focusable}
        style={{ paddingVertical: 8, color: '#fff' }}
      />
    </View>
  );
});

type CategoryListItem = { id: string; name: string };

const CategoryPill = memo(function CategoryPill({
  focusKey,
  label,
  isSelected,
  isFocused,
  onSelect,
  onFocusKey,
  onBlurKey,
  compact,
  focusable,
}: {
  focusKey: string;
  label: string;
  isSelected: boolean;
  isFocused: boolean;
  onSelect: () => void;
  onFocusKey: (k: string) => void;
  onBlurKey: () => void;
  compact?: boolean;
  focusable?: boolean;
}) {
  return (
    <Pressable
      onPress={onSelect}
      onFocus={() => onFocusKey(focusKey)}
      onBlur={onBlurKey}
      focusable={focusable !== false}
      style={{
        minHeight: CATEGORY_PILL_HEIGHT,
        paddingHorizontal: 14,
        marginRight: compact ? 8 : 0,
        marginBottom: compact ? 0 : 8,
        borderRadius: 20,
        borderWidth: isFocused ? 3 : 1,
        borderColor: isFocused ? '#d8b4fe' : '#3f3f46',
        backgroundColor: isSelected ? 'rgba(139, 92, 246, 0.25)' : 'rgba(39, 39, 50, 0.8)',
        justifyContent: 'center',
      }}
    >
      <Text className="text-white text-sm" numberOfLines={1}>{label}</Text>
    </Pressable>
  );
});

const ChannelRow = memo(function ChannelRow({
  item,
  isFocused,
  isHeartFocused,
  isFav,
  isNowPlaying,
  onPress,
  onFavorite,
  onFocusKey,
  onBlurKey,
  nextFocusRight,
  focusable,
}: {
  item: Channel;
  isFocused: boolean;
  isHeartFocused: boolean;
  isFav: boolean;
  isNowPlaying: boolean;
  onPress: (ch: Channel) => void;
  onFavorite: (id: string) => void;
  onFocusKey: (k: string) => void;
  onBlurKey: () => void;
  /** Android TV: node handle of player first focusable so D-pad Right goes to player */
  nextFocusRight?: number | null;
  focusable?: boolean;
}) {
  const rowRef = useRef<React.ComponentRef<typeof Pressable>>(null);
  const heartRef = useRef<React.ComponentRef<typeof Pressable>>(null);

  // setNativeProps ensures nextFocusRight is applied on Android (prop alone can be lost with FlatList recycling)
  useEffect(() => {
    if (nextFocusRight == null) return;
    const refs = [rowRef.current, heartRef.current];
    refs.forEach((r) => {
      if (r?.setNativeProps) {
        try {
          r.setNativeProps({ nextFocusRight });
        } catch {
          // ignore if unmounted
        }
      }
    });
  }, [nextFocusRight]);

  return (
    <Pressable
      ref={rowRef}
      onPress={() => onPress(item)}
      onLongPress={() => onFavorite(item.id)}
      onFocus={() => onFocusKey(`channel-${item.id}`)}
      onBlur={onBlurKey}
      {...(nextFocusRight != null ? { nextFocusRight } as { nextFocusRight: number } : {})}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        height: CHANNEL_ROW_HEIGHT,
        paddingHorizontal: 16,
        gap: 12,
        backgroundColor: isNowPlaying ? 'rgba(139, 92, 246, 0.12)' : 'transparent',
        borderWidth: isFocused ? 3 : 0,
        borderColor: '#d8b4fe',
      }}
      focusable={focusable !== false}
    >
      {item.logo ? (
        <Image source={{ uri: item.logo }} style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: '#272732' }} resizeMode="cover" />
      ) : (
        <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: '#272732', alignItems: 'center', justifyContent: 'center' }}>
          <MaterialCommunityIcons name="television" size={22} color="#6e6e7d" />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text className="text-white text-base font-medium" numberOfLines={1}>{item.name}</Text>
        {isNowPlaying && (
          <Text style={{ color: '#a78bfa', fontSize: 12, marginTop: 2 }}>Jetzt läuft</Text>
        )}
      </View>
      <Pressable
        ref={heartRef}
        onPress={() => onFavorite(item.id)}
        onFocus={() => onFocusKey(`channel-fav-${item.id}`)}
        onBlur={onBlurKey}
        {...(nextFocusRight != null ? { nextFocusRight } as { nextFocusRight: number } : {})}
        style={{
          width: 40,
          height: 40,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: isHeartFocused ? 2 : 0,
          borderColor: '#d8b4fe',
          borderRadius: 8,
        }}
        focusable={focusable !== false}
        hitSlop={8}
      >
        <MaterialCommunityIcons
          name={isFav ? 'heart' : 'heart-outline'}
          size={22}
          color={isFav ? '#ec4899' : '#6e6e7d'}
        />
      </Pressable>
    </Pressable>
  );
});

export function LiveScreen() {
  const navigation = useNavigation<any>();
  const { currentChannel, setCurrentChannel, playerFocusNodeHandle, fullscreen, playerControlsFocused, setPlayerControlsFocused } = usePlayer();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Channel[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const [categoryFilterQuery, setCategoryFilterQuery] = useState('');
  const [categoryFilterHandle, setCategoryFilterHandle] = useState<number | null>(null);
  const searchVersionRef = useRef(0);
  const categoryListRef = useRef<FlatList<CategoryListItem>>(null);
  const categoryFilterRef = useRef<TextInput | null>(null);

  /** Keep category navigation stable and independent from channel search query. */
  const allCategoryListData = useMemo<CategoryListItem[]>(() => {
    return [{ id: '__all__', name: 'All' }, ...categories.map((c) => ({ id: c.id, name: c.name }))];
  }, [categories]);

  const categoryListData = useMemo<CategoryListItem[]>(() => {
    const q = categoryFilterQuery.trim().toLowerCase();
    if (!q) return allCategoryListData;
    return allCategoryListData.filter((item) => item.id === '__all__' || item.name.toLowerCase().includes(q));
  }, [allCategoryListData, categoryFilterQuery]);

  const selectedCategoryName = useMemo(() => {
    if (!selectedCategoryId) return 'All';
    return categories.find((c) => c.id === selectedCategoryId)?.name ?? 'All';
  }, [categories, selectedCategoryId]);

  const showSearchResults = debouncedSearchQuery.length >= MIN_SEARCH_LENGTH;
  const displayChannels = showSearchResults ? searchResults : channels;

  const refreshProviders = useCallback(async () => {
    const list = await providerService.list();
    setProviders(list);
    if (list.length > 0 && !selectedProviderId) setSelectedProviderId(list[0].id);
    return list;
  }, [selectedProviderId]);

  const loadData = useCallback(async () => {
    if (!selectedProviderId) {
      setCategories([]);
      setChannels([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [cats, chs] = await Promise.all([
        liveService.getCategories(selectedProviderId),
        liveService.getChannels(selectedProviderId, selectedCategoryId ?? undefined),
      ]);
      setCategories(cats);
      setChannels(chs);
      const favs = await favoriteRepo.all();
      setFavoriteIds(new Set(favs.map((f) => f.channelId)));
    } finally {
      setLoading(false);
    }
  }, [selectedProviderId, selectedCategoryId]);

  useFocusEffect(
    useCallback(() => {
      refreshProviders().then((list) => {
        if (list.length > 0 && selectedProviderId) loadData();
        else setLoading(false);
      });
    }, [selectedProviderId, refreshProviders, loadData])
  );

  useEffect(() => {
    if (selectedProviderId) loadData();
  }, [selectedProviderId, selectedCategoryId, loadData]);

  useEffect(() => {
    if (!selectedCategoryId) return;
    if (!categories.some((c) => c.id === selectedCategoryId)) {
      setSelectedCategoryId(null);
    }
  }, [categories, selectedCategoryId]);

  // Run DB search when debounced query changes. Deferred with setTimeout so UI stays responsive.
  // InteractionManager deprecation in console comes from React Navigation (useFocusEffect), not from this screen.
  useEffect(() => {
    if (debouncedSearchQuery.length < MIN_SEARCH_LENGTH || !selectedProviderId) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const version = ++searchVersionRef.current;
    let cancelled = false;
    const t = setTimeout(() => {
      if (cancelled || version !== searchVersionRef.current) return;
      channelRepo.search(selectedProviderId, debouncedSearchQuery, SEARCH_LIMIT, selectedCategoryId ?? undefined).then((results) => {
        if (cancelled || version !== searchVersionRef.current) return;
        setSearchResults(results);
        setSearching(false);
      }).catch(() => {
        if (!cancelled && version === searchVersionRef.current) setSearching(false);
      });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [debouncedSearchQuery, selectedProviderId, selectedCategoryId]);

  // Scroll category list so focused pill is visible (virtualized list = only ~12 pills mounted → less lag)
  useEffect(() => {
    if (!categoriesExpanded || categoryListData.length === 0) return;
    const idx = categoryListData.findIndex(
      (item) => (item.id === '__all__' && focusedKey === 'category-all') || focusedKey === `category-${item.id}`
    );
    if (idx >= 0) {
      try {
        categoryListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
      } catch {
        // index may be out of rendered window
      }
    }
  }, [focusedKey, categoriesExpanded, categoryListData]);

  const toggleFavorite = useCallback(async (channelId: string) => {
    const has = await favoriteRepo.has(channelId);
    if (has) await favoriteRepo.remove(channelId);
    else await favoriteRepo.add(channelId);
    const favs = await favoriteRepo.all();
    setFavoriteIds(new Set(favs.map((f) => f.channelId)));
  }, []);

  const openPlayer = useCallback((channel: Channel) => {
    setCurrentChannel(channel);
  }, [setCurrentChannel]);

  const setProvider = useCallback((id: string) => {
    setSelectedProviderId(id);
    setSelectedCategoryId(null);
    setCategoryFilterQuery('');
  }, []);

  const setFocusedKeyStable = useCallback((k: string) => setFocusedKey(k), []);
  const onChannelFocusKey = useCallback(
    (k: string) => {
      setFocusedKey(k);
      if (k.startsWith('channel-')) setPlayerControlsFocused(false);
    },
    [setPlayerControlsFocused]
  );
  const clearFocusedKey = useCallback(() => setFocusedKey(null), []);
  const setCategoryId = useCallback((id: string | null) => setSelectedCategoryId(id), []);

  const handleSearchChange = useCallback((query: string) => {
    setDebouncedSearchQuery(query);
  }, []);

  const renderChannelItem = useCallback(
    ({ item }: ListRenderItemInfo<Channel>) => (
      <ChannelRow
        item={item}
        isFocused={focusedKey === `channel-${item.id}` && !playerControlsFocused}
        isHeartFocused={focusedKey === `channel-fav-${item.id}` && !playerControlsFocused}
        isFav={favoriteIds.has(item.id)}
        isNowPlaying={currentChannel?.id === item.id}
        onPress={openPlayer}
        onFavorite={toggleFavorite}
        onFocusKey={onChannelFocusKey}
        onBlurKey={clearFocusedKey}
        nextFocusRight={playerFocusNodeHandle}
        focusable={!fullscreen}
      />
    ),
    [focusedKey, favoriteIds, currentChannel?.id, openPlayer, toggleFavorite, onChannelFocusKey, clearFocusedKey, playerFocusNodeHandle, fullscreen, playerControlsFocused]
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: CHANNEL_ROW_HEIGHT,
      offset: CHANNEL_ROW_HEIGHT * index,
      index,
    }),
    []
  );

  const getCategoryItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: CATEGORY_ROW_HEIGHT,
      offset: CATEGORY_ROW_HEIGHT * index,
      index,
    }),
    []
  );

  const renderCategoryItem = useCallback(
    ({ item }: ListRenderItemInfo<CategoryListItem>) => {
      const focusKey = item.id === '__all__' ? 'category-all' : `category-${item.id}`;
      const isSelected = item.id === '__all__' ? selectedCategoryId === null : selectedCategoryId === item.id;
      return (
        <CategoryPill
          focusKey={focusKey}
          label={item.name}
          isSelected={isSelected}
          isFocused={focusedKey === focusKey}
          onSelect={() => {
            setCategoryId(item.id === '__all__' ? null : item.id);
            setCategoriesExpanded(false);
          }}
          onFocusKey={setFocusedKeyStable}
          onBlurKey={clearFocusedKey}
          compact={false}
          focusable={!fullscreen}
        />
      );
    },
    [selectedCategoryId, focusedKey, setFocusedKeyStable, clearFocusedKey, setCategoryId, fullscreen]
  );

  if (loading && providers.length === 0) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: '#0e0e12' }}>
        <ActivityIndicator size="large" color="#8b5cf6" />
      </View>
    );
  }

  if (providers.length === 0) {
    const openSettingsFocused = focusedKey === 'open-settings';
    return (
      <View className="flex-1 p-6 justify-center items-center" style={{ backgroundColor: '#0e0e12' }}>
        <Text className="text-white text-lg mb-2">No providers</Text>
        <Text className="text-zinc-400 text-center mb-6">Add an Xtream or M3U provider in Settings.</Text>
        <Pressable
          onPress={() => navigation.navigate('Settings')}
          onFocus={() => setFocusedKey('open-settings')}
          onBlur={() => setFocusedKey(null)}
          focusable={!fullscreen}
          className="px-6 py-3 rounded-xl bg-primary-500"
          style={{
            borderWidth: openSettingsFocused ? 3 : 0,
            borderColor: '#d8b4fe',
          }}
        >
          <Text className="text-white font-medium">Open Settings</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: '#0e0e12' }}
      pointerEvents={fullscreen ? 'none' : 'auto'}
      importantForAccessibility={fullscreen ? 'no-hide-descendants' : 'auto'}
    >
      {/* Provider pills – only when multiple */}
      {providers.length > 1 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#272732' }}>
          {providers.map((p) => {
            const isFocused = focusedKey === `provider-${p.id}`;
            return (
              <Pressable
                key={p.id}
                onPress={() => setProvider(p.id)}
                onFocus={() => setFocusedKey(`provider-${p.id}`)}
                onBlur={clearFocusedKey}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 20,
                  borderWidth: isFocused ? 3 : 1,
                  borderColor: isFocused ? '#d8b4fe' : '#3f3f46',
                  backgroundColor: selectedProviderId === p.id ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                }}
                focusable={!fullscreen}
              >
                <Text className="text-white text-sm">{p.name}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Search only – Sync is in Settings to avoid blocking Live */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#272732' }}>
        <DebouncedSearchInput
          placeholder="Kanäle suchen..."
          onSearchChange={handleSearchChange}
          minLength={MIN_SEARCH_LENGTH}
          debounceMs={SEARCH_DEBOUNCE_MS}
          isFocused={focusedKey === 'search'}
          onFocusKey={() => setFocusedKey('search')}
          onBlurKey={clearFocusedKey}
          focusable={!fullscreen}
        />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#272732' }}>
        <Text className="text-zinc-300 text-xs">Category: <Text className="text-white">{selectedCategoryName}</Text></Text>
        {showSearchResults ? (
          <Text className="text-zinc-300 text-xs">Search results: <Text className="text-white">{searchResults.length}</Text></Text>
        ) : (
          <Text className="text-zinc-300 text-xs">Channels: <Text className="text-white">{channels.length}</Text></Text>
        )}
      </View>

      {/* Categories: scalable picker (works better with very many categories) */}
      {categories.length > 0 && (
        <View style={{ borderBottomWidth: 1, borderBottomColor: '#272732' }}>
          <Pressable
            onPress={() => setCategoriesExpanded((e) => !e)}
            onFocus={() => setFocusedKey('categories-toggle')}
            onBlur={clearFocusedKey}
            focusable={!fullscreen}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 12,
              gap: 6,
              backgroundColor: focusedKey === 'categories-toggle' ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
              borderWidth: focusedKey === 'categories-toggle' ? 2 : 0,
              borderColor: '#d8b4fe',
            }}
            {...(categoryFilterHandle != null
              ? ({ nextFocusDown: categoryFilterHandle } as { nextFocusDown: number })
              : {})}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text className="text-white font-medium">Categories</Text>
                <Text className="text-zinc-400 text-xs">({categories.length + 1})</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text className="text-zinc-300 text-xs" numberOfLines={1}>{selectedCategoryName}</Text>
                <MaterialCommunityIcons name={categoriesExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#9ca3af" />
              </View>
            </Pressable>
            {categoriesExpanded && (
              <View style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10, gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 38, paddingHorizontal: 12, borderRadius: 10, borderWidth: focusedKey === 'category-search' ? 3 : 1, borderColor: focusedKey === 'category-search' ? '#d8b4fe' : '#3f3f46', backgroundColor: '#1c1c24' }}>
                  <MaterialCommunityIcons name="filter-variant" size={18} color="#6e6e7d" />
                  <TextInput
                    ref={(node) => {
                      categoryFilterRef.current = node;
                      setCategoryFilterHandle(node ? findNodeHandle(node) : null);
                    }}
                    className="flex-1 text-white text-sm p-0"
                    placeholder="Kategorie filtern..."
                    placeholderTextColor="#6e6e7d"
                    value={categoryFilterQuery}
                    onChangeText={setCategoryFilterQuery}
                    onFocus={() => setFocusedKey('category-search')}
                    onBlur={clearFocusedKey}
                    focusable={!fullscreen}
                    style={{ paddingVertical: 8, color: '#fff' }}
                  />
                  {categoryFilterQuery.length > 0 && (
                    <Pressable
                      onPress={() => setCategoryFilterQuery('')}
                      onFocus={() => setFocusedKey('category-search-clear')}
                      onBlur={clearFocusedKey}
                      focusable={!fullscreen}
                      style={{ paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, borderWidth: focusedKey === 'category-search-clear' ? 2 : 0, borderColor: '#d8b4fe' }}
                    >
                      <Text className="text-zinc-300 text-xs">Clear</Text>
                    </Pressable>
                  )}
                </View>

                <FlatList<CategoryListItem>
                  ref={categoryListRef}
                  data={categoryListData}
                  keyExtractor={(item) => item.id}
                  renderItem={renderCategoryItem}
                  showsVerticalScrollIndicator
                  getItemLayout={getCategoryItemLayout}
                  initialNumToRender={16}
                  windowSize={8}
                  maxToRenderPerBatch={16}
                  style={{ maxHeight: CATEGORY_PICKER_MAX_HEIGHT }}
                  contentContainerStyle={{ paddingBottom: 2 }}
                  onScrollToIndexFailed={() => {}}
                />
              </View>
            )}
        </View>
      )}

      {/* Channel list */}
      {loading && channels.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#8b5cf6" />
        </View>
      ) : displayChannels.length === 0 ? (
        <View className="flex-1 items-center justify-center" style={{ paddingHorizontal: 24 }}>
          <MaterialCommunityIcons name="television-off" size={54} color="#52525b" />
          <Text className="text-white text-base mt-4">No channels found</Text>
          <Text className="text-zinc-400 text-center mt-1">
            {showSearchResults
              ? `No result in "${selectedCategoryName}" for "${debouncedSearchQuery}".`
              : `No channels in "${selectedCategoryName}" yet. Sync provider in Settings.`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayChannels}
          keyExtractor={(item) => item.id}
          renderItem={renderChannelItem}
          getItemLayout={getItemLayout}
          contentContainerStyle={{ paddingBottom: 48 }}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={7}
          initialNumToRender={14}
        />
      )}

      {searching && showSearchResults && (
        <View style={{ position: 'absolute', top: '50%', left: 0, right: 0, alignItems: 'center' }}>
          <ActivityIndicator size="small" color="#8b5cf6" />
        </View>
      )}
    </View>
  );
}
