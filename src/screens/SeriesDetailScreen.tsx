import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  findNodeHandle,
} from 'react-native';
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
      className={`items-center rounded-xl border-2 px-4 py-2 ${
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
            ? 'text-sm font-semibold text-white'
            : 'text-sm font-medium text-slate-300'
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
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/80 px-10">
        <View className="w-full max-w-[480px] rounded-3xl border border-slate-800 bg-slate-950 p-6">
          <Text className="mb-4 text-center text-xl font-bold text-slate-50">
            Staffel waehlen
          </Text>

          <View className="mb-4 flex-row items-center rounded-xl border border-slate-700 bg-slate-900 px-3 py-2">
            <MaterialCommunityIcons name="magnify" size={18} color="#9ca3af" />
            <Text className="ml-2 text-xs text-slate-400" numberOfLines={1}>
              Tippe die Staffelnummer, um zu filtern.
            </Text>
          </View>

          <View className="mb-4 flex-row flex-wrap gap-3">
            {seasons.length === 0 ? (
              <Text className="text-sm text-slate-500">Keine Staffeln gefunden.</Text>
            ) : (
              seasons.map((season) => (
                <SeasonChip
                  key={season.id}
                  label={`Staffel ${season.seasonNumber}`}
                  selected={season.seasonNumber === selectedSeasonNumber}
                  onPress={() => {
                    onSelect(season.seasonNumber);
                    onClose();
                  }}
                />
              ))
            )}
          </View>

          <Pressable
            onPress={onClose}
            focusable
            className="mt-1 items-center rounded-xl border border-slate-700 bg-slate-800 py-3"
          >
            <Text className="font-semibold text-slate-200">Abbrechen</Text>
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
      className={`mb-3 mr-3 min-w-[280px] max-w-[380px] flex-1 overflow-hidden rounded-2xl border-2 ${
        focused ? 'border-purple-300 bg-slate-800' : 'border-slate-800 bg-slate-900/70'
      }`}
    >
      <View className="flex-row">
        <View className="h-[68px] w-[120px] shrink-0 overflow-hidden rounded-l-xl bg-slate-800">
          {imageUri ? (
            <Image source={{ uri: imageUri }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <View className="h-full w-full items-center justify-center">
              <MaterialCommunityIcons name="play-circle-outline" size={28} color="#64748b" />
            </View>
          )}
        </View>
        <View className="min-w-0 flex-1 justify-center p-3">
          <Text className="mb-0.5 text-xs font-medium text-slate-400" numberOfLines={1}>
            S{episode.seasonNumber} · E{episode.episodeNumber}
          </Text>
          <Text className="text-sm font-semibold text-slate-50" numberOfLines={2}>
            {episode.title}
          </Text>
          {episode.summary ? (
            <Text className="mt-1 text-[11px] text-slate-400" numberOfLines={2}>
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
            fetchedSeasons.map((season, index) => ({
              id: `season_${season.seasonNumber}_${index}`,
              seasonNumber: season.seasonNumber,
              episodes: season.episodes,
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
    () => seasons.find((season) => season.seasonNumber === selectedSeasonNumber) ?? null,
    [seasons, selectedSeasonNumber],
  );

  const allEpisodes = useMemo(
    () =>
      [...seasons]
        .sort((a, b) => a.seasonNumber - b.seasonNumber)
        .flatMap((season) =>
          [...season.episodes].sort((a, b) => a.episodeNumber - b.episodeNumber),
        ),
    [seasons],
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

      const episodeQueue = allEpisodes
        .filter((item) => !!item.streamUrl)
        .map((item) => ({
          movieId: seriesId,
          episodeId: item.id,
          streamUrlOverride: item.streamUrl as string,
          titleOverride: `${series?.name ?? ''} - S${item.seasonNumber}E${item.episodeNumber}`,
        }));

      navigation.navigate('MoviePlayer', {
        episodeQueue,
        movieId: seriesId,
        episodeId: episode.id,
        streamUrlOverride: episode.streamUrl,
        titleOverride: `${series?.name ?? ''} - S${episode.seasonNumber}E${episode.episodeNumber}`,
      });
    },
    [allEpisodes, navigation, series?.name, seriesId],
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
        <Text className="mb-3 text-lg text-slate-100">Serie nicht gefunden</Text>
        <Pressable
          onPress={() => navigation.goBack()}
          onFocus={() => setFocusedButton('back')}
          onBlur={() => setFocusedButton(null)}
          focusable
          className={`rounded-full border px-5 py-2 ${
            focusedButton === 'back'
              ? 'border-purple-300 bg-slate-800'
              : 'border-slate-700 bg-slate-900'
          }`}
        >
          <Text className="text-slate-100">Zurueck</Text>
        </Pressable>
      </View>
    );
  }

  const posterUri = (series.poster ?? '').trim() || null;

  return (
    <View className="flex-1 bg-[#05050a]">
      <View className="flex-row items-center px-8 pb-2 pt-6">
        <Pressable
          ref={(node) => {
            backButtonRef.current = node;
            setBackButtonHandle(node ? findNodeHandle(node) : null);
          }}
          onPress={() => navigation.goBack()}
          onFocus={() => setFocusedButton('back')}
          onBlur={() => setFocusedButton(null)}
          focusable
          className={`flex-row items-center rounded-full border px-4 py-2 ${
            focusedButton === 'back'
              ? 'border-purple-300 bg-slate-900'
              : 'border-slate-700 bg-transparent'
          }`}
        >
          <MaterialCommunityIcons name="arrow-left" size={20} color="#e5e7eb" />
          <Text className="ml-2 text-slate-100">Zurueck</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{}}>
        <View className="px-8 pb-10">
          <View className="mb-8 mt-4 flex-row">
            <View className="h-[320px] w-[260px] overflow-hidden rounded-[32px] bg-slate-900">
              {posterUri ? (
                <Image source={{ uri: posterUri }} className="h-full w-full" resizeMode="cover" />
              ) : (
                <View className="flex-1 items-center justify-center">
                  <MaterialCommunityIcons name="television-classic" size={72} color="#4b5563" />
                </View>
              )}
            </View>

            <View className="ml-10 flex-1 justify-center">
              <Text className="mb-3 text-2xl font-extrabold text-slate-50" numberOfLines={2}>
                {series.name}
              </Text>

              <Text className="mb-6 max-w-[620px] text-sm leading-5 text-slate-400" numberOfLines={6}>
                {seriesDescription?.trim() ||
                  'Keine Beschreibung vom Provider verfuegbar. Waehle eine Episode aus und lehne dich zurueck.'}
              </Text>

              <View className="mb-4 flex-row items-center">
                <Pressable
                  ref={ctaPlayRef}
                  onPress={() => {
                    const firstEpisode = episodes[0];
                    if (firstEpisode) handlePlayEpisode(firstEpisode);
                  }}
                  onFocus={() => setFocusedButton('play')}
                  onBlur={() => setFocusedButton(null)}
                  focusable
                  className={`mr-4 flex-row items-center rounded-full border px-8 py-3 ${
                    focusedButton === 'play'
                      ? 'border-purple-100 bg-purple-300'
                      : 'border-transparent bg-purple-500'
                  }`}
                  {...(backButtonHandle != null
                    ? ({ nextFocusUp: backButtonHandle } as Record<string, number>)
                    : {})}
                >
                  <MaterialCommunityIcons name="play" size={22} color="#020617" />
                  <Text className="ml-2 text-base font-bold text-slate-950">Abspielen</Text>
                </Pressable>

                <Pressable
                  onPress={toggleFavorite}
                  onFocus={() => setFocusedButton('favorite')}
                  onBlur={() => setFocusedButton(null)}
                  focusable
                  className={`flex-row items-center rounded-full border px-5 py-3 ${
                    focusedButton === 'favorite'
                      ? 'border-purple-200 bg-slate-900'
                      : favorite
                        ? 'border-rose-400 bg-rose-900/20'
                        : 'border-slate-700 bg-transparent'
                  }`}
                  {...(backButtonHandle != null
                    ? ({ nextFocusUp: backButtonHandle } as Record<string, number>)
                    : {})}
                >
                  <MaterialCommunityIcons
                    name={favorite ? 'heart' : 'heart-outline'}
                    size={20}
                    color={favorite ? '#fb7185' : '#9ca3af'}
                  />
                  <Text className="ml-2 text-sm text-slate-100">
                    {favorite ? 'In Favoriten' : 'Zu Favoriten'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-base font-semibold text-slate-200">Episoden</Text>

            <Pressable
              onPress={() => {
                if (seasons.length > 1) setSeasonModalVisible(true);
              }}
              onFocus={() => setFocusedButton('season')}
              onBlur={() => setFocusedButton(null)}
              focusable
              className={`flex-row items-center rounded-xl border px-4 py-2 ${
                focusedButton === 'season'
                  ? 'border-purple-300 bg-slate-800'
                  : 'border-slate-700 bg-slate-900'
              }`}
            >
              <Text className="mr-2 text-sm text-slate-100">
                Staffel {selectedSeasonNumber ?? 1}
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={18} color="#e5e7eb" />
            </Pressable>
          </View>

          <View className="flex-row flex-wrap">
            {episodes.length === 0 ? (
              <Text className="mt-2 text-sm text-slate-500">Keine Episoden verfuegbar.</Text>
            ) : (
              episodes.map((episode) => (
                <EpisodeCard key={episode.id} episode={episode} onPlay={handlePlayEpisode} />
              ))
            )}
          </View>

          <SeasonModal
            visible={seasonModalVisible}
            seasons={seasons}
            selectedSeasonNumber={selectedSeasonNumber}
            onSelect={(seasonNumber) => setSelectedSeasonNumber(seasonNumber)}
            onClose={() => setSeasonModalVisible(false)}
          />
        </View>
      </ScrollView>
    </View>
  );
}
