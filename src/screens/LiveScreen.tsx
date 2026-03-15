import React, { useCallback, useEffect, useState, memo, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  Image,
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
const CATEGORY_PILL_WIDTH = 140;
const CATEGORY_PILL_HEIGHT = 40;
const CATEGORY_LIST_INITIAL_RENDER = 12;
const CATEGORY_LIST_WINDOW = 5;

// Search input that only notifies parent after debounce – avoids re-rendering whole screen on every key
const DebouncedSearchInput = memo(function DebouncedSearchInput({
  placeholder,
  onSearchChange,
  minLength,
  debounceMs,
  isFocused,
  onFocusKey,
  onBlurKey,
}: {
  placeholder: string;
  onSearchChange: (query: string) => void;
  minLength: number;
  debounceMs: number;
  isFocused: boolean;
  onFocusKey: () => void;
  onBlurKey: () => void;
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
  width,
}: {
  focusKey: string;
  label: string;
  isSelected: boolean;
  isFocused: boolean;
  onSelect: () => void;
  onFocusKey: (k: string) => void;
  onBlurKey: () => void;
  width?: number;
}) {
  return (
    <Pressable
      onPress={onSelect}
      onFocus={() => onFocusKey(focusKey)}
      onBlur={onBlurKey}
      style={{
        width: width ?? undefined,
        minWidth: width ?? undefined,
        height: CATEGORY_PILL_HEIGHT,
        paddingHorizontal: 14,
        marginRight: 8,
        borderRadius: 20,
        borderWidth: isFocused ? 3 : 1,
        borderColor: isFocused ? '#d8b4fe' : '#3f3f46',
        backgroundColor: isSelected ? 'rgba(139, 92, 246, 0.25)' : 'rgba(39, 39, 50, 0.8)',
        justifyContent: 'center',
      }}
      focusable
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
      focusable
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
        focusable
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
  const { currentChannel, setCurrentChannel, playerFocusNodeHandle } = usePlayer();
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
  const searchVersionRef = useRef(0);
  const categoryListRef = useRef<FlatList<CategoryListItem>>(null);

  /** Categories filtered by search (client-side). Same search box filters both categories and channels. */
  const categoryListData = useMemo<CategoryListItem[]>(() => {
    const base = [{ id: '__all__', name: 'All' }, ...categories.map((c) => ({ id: c.id, name: c.name }))];
    const q = debouncedSearchQuery.trim().toLowerCase();
    if (!q) return base;
    return [
      { id: '__all__', name: 'All' },
      ...categories.filter((c) => c.name.toLowerCase().includes(q)).map((c) => ({ id: c.id, name: c.name })),
    ];
  }, [categories, debouncedSearchQuery]);

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
      channelRepo.search(selectedProviderId, debouncedSearchQuery, SEARCH_LIMIT).then((results) => {
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
  }, [debouncedSearchQuery, selectedProviderId]);

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
  }, []);

  const setFocusedKeyStable = useCallback((k: string) => setFocusedKey(k), []);
  const clearFocusedKey = useCallback(() => setFocusedKey(null), []);
  const setCategoryId = useCallback((id: string | null) => setSelectedCategoryId(id), []);

  const handleSearchChange = useCallback((query: string) => {
    setDebouncedSearchQuery(query);
  }, []);

  const renderChannelItem = useCallback(
    ({ item }: ListRenderItemInfo<Channel>) => (
      <ChannelRow
        item={item}
        isFocused={focusedKey === `channel-${item.id}`}
        isHeartFocused={focusedKey === `channel-fav-${item.id}`}
        isFav={favoriteIds.has(item.id)}
        isNowPlaying={currentChannel?.id === item.id}
        onPress={openPlayer}
        onFavorite={toggleFavorite}
        onFocusKey={setFocusedKeyStable}
        onBlurKey={clearFocusedKey}
        nextFocusRight={playerFocusNodeHandle}
      />
    ),
    [focusedKey, favoriteIds, currentChannel?.id, openPlayer, toggleFavorite, setFocusedKeyStable, clearFocusedKey, playerFocusNodeHandle]
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
      length: CATEGORY_PILL_WIDTH + 8,
      offset: (CATEGORY_PILL_WIDTH + 8) * index,
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
          onSelect={() => setCategoryId(item.id === '__all__' ? null : item.id)}
          onFocusKey={setFocusedKeyStable}
          onBlurKey={clearFocusedKey}
          width={CATEGORY_PILL_WIDTH}
        />
      );
    },
    [selectedCategoryId, focusedKey, setFocusedKeyStable, clearFocusedKey, setCategoryId]
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
          className="px-6 py-3 rounded-xl bg-primary-500"
          style={{
            borderWidth: openSettingsFocused ? 3 : 0,
            borderColor: '#d8b4fe',
          }}
          focusable
        >
          <Text className="text-white font-medium">Open Settings</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: '#0e0e12' }}>
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
                focusable
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
          placeholder="Kanäle & Kategorien suchen..."
          onSearchChange={handleSearchChange}
          minLength={MIN_SEARCH_LENGTH}
          debounceMs={SEARCH_DEBOUNCE_MS}
          isFocused={focusedKey === 'search'}
          onFocusKey={() => setFocusedKey('search')}
          onBlurKey={clearFocusedKey}
        />
      </View>

      {/* Categories – horizontal virtualized list: only ~12 pills mounted → no lag (like channel list) */}
      {categories.length > 0 && (
        <View style={{ borderBottomWidth: 1, borderBottomColor: '#272732' }}>
          <Pressable
            onPress={() => setCategoriesExpanded((e) => !e)}
            onFocus={() => setFocusedKey('categories-toggle')}
            onBlur={clearFocusedKey}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 12,
              gap: 6,
              backgroundColor: focusedKey === 'categories-toggle' ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
              borderWidth: focusedKey === 'categories-toggle' ? 2 : 0,
              borderColor: '#d8b4fe',
            }}
            focusable
          >
            <Text className="text-white font-medium">Categories</Text>
            <MaterialCommunityIcons name={categoriesExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#9ca3af" />
          </Pressable>
          {categoriesExpanded && (
            <FlatList<CategoryListItem>
              ref={categoryListRef}
              data={categoryListData}
              keyExtractor={(item) => item.id}
              renderItem={renderCategoryItem}
              horizontal
              showsHorizontalScrollIndicator={false}
              getItemLayout={getCategoryItemLayout}
              initialNumToRender={CATEGORY_LIST_INITIAL_RENDER}
              windowSize={CATEGORY_LIST_WINDOW}
              maxToRenderPerBatch={8}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4 }}
              onScrollToIndexFailed={() => {}}
            />
          )}
        </View>
      )}

      {/* Channel list */}
      {loading && channels.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#8b5cf6" />
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
