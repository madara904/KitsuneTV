import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View, findNodeHandle } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { mediaService } from '../services/mediaService';
import { mediaCollectionRepo } from '../db/repositories/mediaCollectionRepo';
import type { Movie } from '../lib/types';

type FocusedButton = 'play' | 'favorite' | 'back' | null;

export function MovieDetailScreen({ route, navigation }: any) {
  const { movieId } = route.params;
  const [movie, setMovie] = useState<Movie | null>(null);
  const [favorite, setFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [movieDescription, setMovieDescription] = useState<string | null>(null);
  const [focusedButton, setFocusedButton] = useState<FocusedButton>(null);
  const backButtonRef = useRef<View | null>(null);
  const playButtonRef = useRef<View | null>(null);
  const [backButtonHandle, setBackButtonHandle] = useState<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [playButtonHandle, setPlayButtonHandle] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [row] = await mediaService.getMoviesByIds([movieId]);
        if (!cancelled) setMovie(row ?? null);
        const favIds = await mediaCollectionRepo.favoriteIds('movie');
        if (!cancelled) setFavorite(favIds.includes(movieId));
        const details = await mediaService.getMovieDetails(movieId);
        if (!cancelled && details.description) setMovieDescription(details.description);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [movieId]);

  const toggleFavorite = useCallback(async () => {
    const next = !favorite;
    setFavorite(next);
    await mediaCollectionRepo.setFavorite('movie', movieId, next);
  }, [favorite, movieId]);

  const handlePlay = useCallback(async () => {
    if (!movie?.streamUrl) return;
    await mediaCollectionRepo.markRecent('movie', movieId);
    navigation.navigate('MoviePlayer', { movieId });
  }, [movie?.streamUrl, movieId, navigation]);

  if (loading) {
    return (
      <View
        className="flex-1"
        style={{ backgroundColor: '#05050a', alignItems: 'center', justifyContent: 'center' }}
      >
        <ActivityIndicator size="large" color="#a855f7" />
      </View>
    );
  }

  if (!movie) {
    return (
      <View
        className="flex-1"
        style={{ backgroundColor: '#05050a', alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ color: '#e5e7eb', fontSize: 18, marginBottom: 12 }}>Film nicht gefunden</Text>
        <Pressable
          onPress={() => navigation.goBack()}
          onFocus={() => setFocusedButton('back')}
          onBlur={() => setFocusedButton(null)}
          focusable
          style={{
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 999,
            backgroundColor: focusedButton === 'back' ? '#374151' : '#1f2937',
            borderWidth: focusedButton === 'back' ? 3 : 0,
            borderColor: '#c4b5fd',
          }}
        >
          <Text style={{ color: '#e5e7eb' }}>Zurück</Text>
        </Pressable>
      </View>
    );
  }

  const posterUri = (movie.poster ?? '').trim() || null;

  return (
    <View className="flex-1" style={{ backgroundColor: '#05050a' }}>
      <View
        style={{
          paddingHorizontal: 32,
          paddingTop: 24,
          paddingBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Pressable
          ref={(node) => {
            backButtonRef.current = node;
            setBackButtonHandle(node ? findNodeHandle(node) : null);
          }}
          onPress={() => navigation.goBack()}
          onFocus={() => setFocusedButton('back')}
          onBlur={() => setFocusedButton(null)}
          focusable
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 18,
            paddingVertical: 8,
            borderRadius: 999,
            backgroundColor: focusedButton === 'back' ? '#111827' : 'transparent',
            borderWidth: focusedButton === 'back' ? 3 : 1,
            borderColor: focusedButton === 'back' ? '#c4b5fd' : '#1f2937',
          }}
        >
          <MaterialCommunityIcons name="arrow-left" size={20} color="#e5e7eb" />
          <Text style={{ color: '#e5e7eb', marginLeft: 6 }}>Zurück</Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 32,
          paddingVertical: 16,
          flexGrow: 1,
          flexDirection: 'row',
        }}
      >
        <View
          style={{
            width: 260,
            height: 360,
            borderRadius: 32,
            overflow: 'hidden',
            backgroundColor: '#111827',
            shadowColor: '#000',
            shadowOpacity: 0.6,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 18 },
          }}
        >
          {posterUri ? (
            <Image source={{ uri: posterUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MaterialCommunityIcons name="movie-open-outline" size={72} color="#4b5563" />
            </View>
          )}
        </View>

        <View style={{ flex: 1, marginLeft: 40, justifyContent: 'center' }}>
          <Text
            style={{
              color: '#f9fafb',
              fontSize: 26,
              fontWeight: '800',
              letterSpacing: 0.4,
              marginBottom: 12,
            }}
            numberOfLines={2}
          >
            {movie.name}
          </Text>

          <Text
            style={{
              color: '#9ca3af',
              fontSize: 14,
              lineHeight: 20,
              maxWidth: 620,
              marginBottom: 24,
            }}
            numberOfLines={6}
          >
            {movieDescription?.trim() ||
              'Keine Beschreibung vom Provider verfügbar. Lehne dich zurück, drücke Play und lass dich überraschen.'}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
            <Pressable
              ref={(node) => {
                playButtonRef.current = node;
                setPlayButtonHandle(node ? findNodeHandle(node) : null);
              }}
              onPress={handlePlay}
              onFocus={() => setFocusedButton('play')}
              onBlur={() => setFocusedButton(null)}
              focusable
              hasTVPreferredFocus
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 32,
                paddingVertical: 14,
                borderRadius: 999,
                backgroundColor: focusedButton === 'play' ? '#c4b5fd' : '#a855f7',
                marginRight: 16,
                borderWidth: focusedButton === 'play' ? 3 : 0,
                borderColor: '#e9d5ff',
              }}
              {...(backButtonHandle != null
                ? ({
                    nextFocusUp: backButtonHandle,
                  } as Record<string, number>)
                : {})}
            >
              <MaterialCommunityIcons name="play" size={22} color="#020617" />
              <Text style={{ color: '#020617', fontSize: 16, fontWeight: '700', marginLeft: 8 }}>Abspielen</Text>
            </Pressable>

            <Pressable
              onPress={toggleFavorite}
              onFocus={() => setFocusedButton('favorite')}
              onBlur={() => setFocusedButton(null)}
              focusable
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderRadius: 999,
                borderWidth: focusedButton === 'favorite' ? 3 : 1,
                borderColor: focusedButton === 'favorite' ? '#e9d5ff' : favorite ? '#fb7185' : '#4b5563',
                backgroundColor: favorite ? 'rgba(248, 113, 113, 0.08)' : 'transparent',
              }}
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
              <Text style={{ color: '#e5e7eb', fontSize: 14, marginLeft: 8 }}>
                {favorite ? 'In Favoriten' : 'Zu Favoriten'}
              </Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View
              style={{
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: '#111827',
              }}
            >
              <Text style={{ color: '#9ca3af', fontSize: 12 }}>Film</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

