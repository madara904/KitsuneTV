import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Text, View, findNodeHandle } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { mediaService } from '../services/mediaService';
import { mediaCollectionRepo } from '../db/repositories/mediaCollectionRepo';
import { watchProgressRepo } from '../db/repositories/watchProgressRepo';
import type { SeriesItem } from '../lib/types';

type FocusedButton = 'back' | 'play' | 'favorite' | 'season' | null;

type Episode = {
  id: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  summary?: string;
  streamUrl?: string;
  imageUrl?: string;
};

type Season = {
  id: string;
  seasonNumber: number;
  episodes: Episode[];
};

const SeasonChip = memo(function SeasonChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      focusable
      className={`px-4 py-2 rounded-xl border-2 border-solid items-center ${
        focused
          ? 'border-purple-300 bg-slate-700'
          : selected
          ? 'border-purple-600 bg-purple-900/40'
          : 'border-slate-700 bg-slate-900'
      }`}
    >
      <Text
        className={
          selected || focused
            ? 'text-sm text-white font-semibold'
            : 'text-sm text-slate-300 font-medium'
        }
      >
        {label}
      </Text>
    </Pressable>
  );
});

const SeasonModal = memo(function SeasonModal({
  visible,
  seasons,
  selectedSeasonNumber,
  onSelect,
  onClose,
}: {
  visible: boolean;
  seasons: Season[];
  selectedSeasonNumber: number | null;
  onSelect: (seasonNumber: number) => void;
  onClose: () => void;
}) {
  const filteredSeasons = useMemo(() => seasons, [seasons]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-center items-center bg-black/80 px-10">
        <View className="w-full max-w-[480px] bg-slate-950 rounded-3xl p-6 border border-slate-800">
          <Text className="text-xl font-bold text-slate-50 mb-4 text-center">
            Staffel wählen
          </Text>

          <View className="flex-row items-center mb-4 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700">
            <MaterialCommunityIcons
              name="magnify"
              size={18}
              color="#9ca3af"
            />
            <Text
              className="ml-2 text-xs text-slate-400"
              numberOfLines={1}
            >
              Tippe die Staffelnummer, um zu filtern.
            </Text>
          </View>

          <View className="flex-row flex-wrap gap-3 mb-4">
            {filteredSeasons.length === 0 ? (
              <Text className="text-sm text-slate-500">
                Keine Staffeln gefunden.
              </Text>
            ) : (
              filteredSeasons.map((s) => (
                <SeasonChip
                  key={s.id}
                  label={`Staffel ${s.seasonNumber}`}
                  selected={s.seasonNumber === selectedSeasonNumber}
                  onPress={() => {
                    onSelect(s.seasonNumber);
                    onClose();
                  }}
                />
              ))
            )}
          </View>

          <Pressable
            onPress={onClose}
            focusable
            className="mt-1 py-3 rounded-xl items-center border border-slate-700 bg-slate-800"
          >
            <Text className="text-slate-200 font-semibold">Abbrechen</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
});

const EpisodeCard = memo(function EpisodeCard({
  episode,
  onPlay,
}: {
  episode: Episode;
  onPlay: (episode: Episode) => void;
}) {
  const [focused, setFocused] = useState(false);
  const imageUri = episode.imageUrl?.trim() || null;
  return (
    <Pressable
      onPress={() => onPlay(episode)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      focusable
      className={`min-w-[280px] max-w-[380px] flex-1 rounded-2xl overflow-hidden mr-3 mb-3 border-2 border-solid ${
        focused ? 'border-purple-300 bg-slate-800' : 'border-slate-800 bg-slate-900/70'
      }`}
    >
      <View className="flex-row">
        <View className="w-[120px] h-[68px] rounded-l-xl bg-slate-800 shrink-0 overflow-hidden">
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <View className="w-full h-full items-center justify-center">
              <MaterialCommunityIcons name="play-circle-outline" size={28} color="#64748b" />
            </View>
          )}
        </View>
        <View className="flex-1 p-3 justify-center min-w-0">
          <Text
            className="text-xs text-slate-400 font-medium mb-0.5"
            numberOfLines={1}
          >
            S{episode.seasonNumber} · E{episode.episodeNumber}
          </Text>
          <Text
            className="text-sm text-slate-50 font-semibold"
            numberOfLines={2}
          >
            {episode.title}
          </Text>
          {episode.summary ? (
            <Text
              className="text-[11px] text-slate-400 mt-1"
              numberOfLines={2}
            >
              {episode.summary}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

export function SeriesDetailScreen({ route, navigation }: any) {
  const { seriesId } = route.params;
  const [series, setSeries] = useState<SeriesItem | null>(null);
  const [favorite, setFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [focusedButton, setFocusedButton] = useState<FocusedButton>(null);

  const backButtonRef = useRef<View | null>(null);
  const ctaPlayRef = useRef<View | null>(null);
  const [backButtonHandle, setBackButtonHandle] = useState<number | null>(null);

  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState<number | null>(null);
  const [seasonModalVisible, setSeasonModalVisible] = useState(false);
  const [seriesDescription, setSeriesDescription] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [row] = await mediaService.getSeriesByIds([seriesId]);
        if (!cancelled) setSeries(row ?? null);
        const favIds = await mediaCollectionRepo.favoriteIds('series');
        if (!cancelled) setFavorite(favIds.includes(seriesId));
        if (cancelled) return;
        const { seriesInfo, seasons: fetchedSeasons } =
          await mediaService.getSeriesSeasonsAndEpisodes(seriesId);
        if (!cancelled) {
          setSeriesDescription(seriesInfo?.description ?? null);
          setSeasons(
            fetchedSeasons.map((s, idx) => ({
              id: `season_${s.seasonNumber}_${idx}`,
              seasonNumber: s.seasonNumber,
              episodes: s.episodes,
            })),
          );
          if (fetchedSeasons.length > 0) {
            setSelectedSeasonNumber(fetchedSeasons[0]?.seasonNumber ?? null);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [seriesId]);

  const toggleFavorite = useCallback(async () => {
    const next = !favorite;
    setFavorite(next);
    await mediaCollectionRepo.setFavorite('series', seriesId, next);
  }, [favorite, seriesId]);

  const currentSeason = useMemo(
    () => seasons.find((s) => s.seasonNumber === selectedSeasonNumber) ?? null,
    [seasons, selectedSeasonNumber],
  );

  const episodes = currentSeason?.episodes ?? [];

  const handlePlayEpisode = useCallback(
    async (episode: Episode) => {
      if (!episode.streamUrl) return;
      console.info(
        '[SeriesEpisodePlay]',
        JSON.stringify({
          seriesId,
          episodeId: episode.id,
          season: episode.seasonNumber,
          episode: episode.episodeNumber,
          streamUrl: episode.streamUrl,
        }),
      );
      await mediaCollectionRepo.markRecent('series', seriesId);
      await watchProgressRepo.save('series', seriesId, episode.id, 0, undefined);
      navigation.navigate('MoviePlayer', {
        movieId: seriesId,
        episodeId: episode.id,
        streamUrlOverride: episode.streamUrl,
        titleOverride: `${series?.name ?? ''} – S${episode.seasonNumber}E${episode.episodeNumber}`,
      });
    },
    [seriesId, navigation, series?.name],
  );

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#05050a]">
        <ActivityIndicator size="large" color="#a855f7" />
      </View>
    );
  }

  if (!series) {
    return (
      <View className="flex-1 items-center justify-center bg-[#05050a]">
        <Text className="text-lg text-slate-100 mb-3">Serie nicht gefunden</Text>
        <Pressable
          onPress={() => navigation.goBack()}
          onFocus={() => setFocusedButton('back')}
          onBlur={() => setFocusedButton(null)}
          focusable
          className={`px-5 py-2 rounded-full border ${
            focusedButton === 'back'
              ? 'bg-slate-800 border-purple-300'
              : 'bg-slate-900 border-slate-700'
          }`}
        >
          <Text className="text-slate-100">Zurück</Text>
        </Pressable>
      </View>
    );
  }

  const posterUri = (series.poster ?? '').trim() || null;

  return (
    <View className="flex-1 bg-[#05050a]">
      {/* Top bar with back */}
      <View className="flex-row items-center px-8 pt-6 pb-2">
        <Pressable
          ref={(node) => {
            backButtonRef.current = node;
            setBackButtonHandle(node ? findNodeHandle(node) : null);
          }}
          onPress={() => navigation.goBack()}
          onFocus={() => setFocusedButton('back')}
          onBlur={() => setFocusedButton(null)}
          focusable
          className={`flex-row items-center px-4 py-2 rounded-full border ${
            focusedButton === 'back'
              ? 'bg-slate-900 border-purple-300'
              : 'bg-transparent border-slate-700'
          }`}
        >
          <MaterialCommunityIcons name="arrow-left" size={20} color="#e5e7eb" />
          <Text className="text-slate-100 ml-2">Zurück</Text>
        </Pressable>
      </View>

      {/* Split layout: top info row + bottom seasons/episodes */}
      <ScrollView contentContainerStyle={{}}>
        <View className="px-8 pb-10">
        {/* Top: image + CTA */}
        <View className="flex-row mt-4 mb-8">
          <View className="w-[260px] h-[320px] rounded-[32px] overflow-hidden bg-slate-900">
            {posterUri ? (
              <Image source={{ uri: posterUri }} className="w-full h-full" resizeMode="cover" />
            ) : (
              <View className="flex-1 items-center justify-center">
                <MaterialCommunityIcons name="television-classic" size={72} color="#4b5563" />
              </View>
            )}
          </View>

          <View className="flex-1 ml-10 justify-center">
            <Text
              className="text-slate-50 text-2xl font-extrabold mb-3"
              numberOfLines={2}
            >
              {series.name}
            </Text>

            <Text
              className="text-sm text-slate-400 leading-5 max-w-[620px] mb-6"
              numberOfLines={6}
            >
              {seriesDescription?.trim() ||
                'Keine Beschreibung vom Provider verfügbar. Wähle eine Episode aus und lehne dich zurück.'}
            </Text>

            <View className="flex-row items-center mb-4">
              <Pressable
                ref={ctaPlayRef}
                onPress={() => {
                  // default: first episode of current season (if available)
                  const first = episodes[0];
                  if (first) handlePlayEpisode(first);
                }}
                onFocus={() => setFocusedButton('play')}
                onBlur={() => setFocusedButton(null)}
                focusable
                className={`flex-row items-center px-8 py-3 rounded-full mr-4 border ${
                  focusedButton === 'play'
                    ? 'bg-purple-300 border-purple-100'
                    : 'bg-purple-500 border-transparent'
                }`}
                {...(backButtonHandle != null
                  ? ({
                      nextFocusUp: backButtonHandle,
                    } as Record<string, number>)
                  : {})}
              >
                <MaterialCommunityIcons name="play" size={22} color="#020617" />
                <Text className="text-base font-bold text-slate-950 ml-2">Abspielen</Text>
              </Pressable>

              <Pressable
                onPress={toggleFavorite}
                onFocus={() => setFocusedButton('favorite')}
                onBlur={() => setFocusedButton(null)}
                focusable
                className={`flex-row items-center px-5 py-3 rounded-full border ${
                  focusedButton === 'favorite'
                    ? 'border-purple-200 bg-slate-900'
                    : favorite
                    ? 'border-rose-400 bg-rose-900/20'
                    : 'border-slate-700 bg-transparent'
                }`}
                {...(backButtonHandle != null
                  ? ({
                      nextFocusUp: backButtonHandle,
                    } as Record<string, number>)
                  : {})}
              >
                <MaterialCommunityIcons
                  name={favorite ? 'heart' : 'heart-outline'}
                  size={20}
                  color={favorite ? '#fb7185' : '#9ca3af'}
                />
                <Text className="text-sm text-slate-100 ml-2">
                  {favorite ? 'In Favoriten' : 'Zu Favoriten'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Bottom: season dropdown + episodes grid */}
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-slate-200 text-base font-semibold">Episoden</Text>

          <Pressable
            onPress={() => {
              if (seasons.length > 1) setSeasonModalVisible(true);
            }}
            onFocus={() => setFocusedButton('season')}
            onBlur={() => setFocusedButton(null)}
            focusable
            className={`flex-row items-center px-4 py-2 rounded-xl border ${
              focusedButton === 'season'
                ? 'bg-slate-800 border-purple-300'
                : 'bg-slate-900 border-slate-700'
            }`}
          >
            <Text className="text-sm text-slate-100 mr-2">
              Staffel {selectedSeasonNumber ?? 1}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={18} color="#e5e7eb" />
          </Pressable>
        </View>

        <View className="flex-row flex-wrap">
          {episodes.length === 0 ? (
            <Text className="text-sm text-slate-500 mt-2">
              Keine Episoden verfügbar.
            </Text>
          ) : (
            episodes.map((ep) => (
              <EpisodeCard key={ep.id} episode={ep} onPlay={handlePlayEpisode} />
            ))
          )}
        </View>
          <SeasonModal
            visible={seasonModalVisible}
            seasons={seasons}
            selectedSeasonNumber={selectedSeasonNumber}
            onSelect={(sn) => setSelectedSeasonNumber(sn)}
            onClose={() => setSeasonModalVisible(false)}
          />
        </View>
      </ScrollView>
    </View>
  );
}

