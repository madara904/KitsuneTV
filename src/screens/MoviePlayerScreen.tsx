import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, Text, View } from 'react-native';
import { VLCPlayer } from 'react-native-vlc-media-player';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { mediaService } from '../services/mediaService';
import { watchProgressRepo } from '../db/repositories/watchProgressRepo';
import type { Movie } from '../lib/types';
import { ResumePromptModal } from '../components/common/ResumePromptModal';

const SAVE_INTERVAL_MS = 8000;
const MIN_RESUME_SEC = 3;

type FocusedControl = 'play' | 'rewind' | 'forward' | 'fullscreen' | 'back' | null;

export function MoviePlayerScreen({ route, navigation }: any) {
  const { movieId, episodeId, streamUrlOverride, titleOverride } = route.params ?? {};
  const isSeriesEpisode = !!episodeId && !!streamUrlOverride;
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialPositionSec, setInitialPositionSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [focusedControl, setFocusedControl] = useState<FocusedControl>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [resumePromptVisible, setResumePromptVisible] = useState(false);

  const videoRef = useRef<any>(null);
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadedRef = useRef(false);
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);
  const resumeHandleRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (isSeriesEpisode) {
          const synthetic: Movie = {
            id: movieId,
            providerId: '',
            categoryId: '',
            name: titleOverride || 'Episode',
            poster: undefined,
            streamUrl: streamUrlOverride,
          };
          if (!cancelled) setMovie(synthetic);
          const progress = await watchProgressRepo.get('series', movieId, episodeId);
          if (
            !cancelled &&
            progress &&
            progress.positionSec != null &&
            progress.positionSec >= MIN_RESUME_SEC
          ) {
            setInitialPositionSec(progress.positionSec);
            setResumePromptVisible(true);
            setPaused(true);
          } else if (!cancelled) {
            setInitialPositionSec(0);
          }
        } else {
          const [row] = await mediaService.getMoviesByIds([movieId]);
          if (!cancelled) setMovie(row ?? null);
          const progress = await watchProgressRepo.get('movie', movieId);
          if (
            !cancelled &&
            progress &&
            progress.positionSec != null &&
            progress.positionSec >= MIN_RESUME_SEC
          ) {
            setInitialPositionSec(progress.positionSec);
            setResumePromptVisible(true);
            setPaused(true);
          } else if (!cancelled) {
            setInitialPositionSec(0);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [movieId, episodeId, streamUrlOverride, titleOverride, isSeriesEpisode]);

  const saveProgress = useCallback(
    (time: number, duration: number) => {
      if (!movieId || duration <= 0) return;
      const contentType: 'movie' | 'series' = isSeriesEpisode ? 'series' : 'movie';
      const epId = isSeriesEpisode ? (episodeId as string | undefined) : undefined;
      watchProgressRepo.save(contentType, movieId, epId, time, duration);
    },
    [movieId, isSeriesEpisode, episodeId],
  );

  useEffect(() => {
    if (!movieId) return;
    saveTimerRef.current = setInterval(() => {
      saveProgress(currentTimeRef.current, durationRef.current);
    }, SAVE_INTERVAL_MS);
    return () => {
      if (saveTimerRef.current) clearInterval(saveTimerRef.current);
      saveTimerRef.current = null;
      saveProgress(currentTimeRef.current, durationRef.current);
    };
  }, [movieId, saveProgress]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (fullscreen) {
        setFullscreen(false);
        return true;
      }
      navigation.goBack();
      return true;
    });
    return () => sub.remove();
  }, [navigation, fullscreen]);

  const handleProgress = useCallback(
    (e: Readonly<{ currentTime: number; playableDuration: number; seekableDuration: number }>) => {
      const normalize = (value: number) => {
        // VLC liefert je nach Plattform Sekunden oder Millisekunden.
        return value > 0 && value > 24 * 3600 ? value / 1000 : value;
      };
      const current = normalize(e.currentTime);
      const effectiveDurationRaw =
        e.seekableDuration > 0 ? e.seekableDuration : e.playableDuration;
      const effectiveDuration = normalize(effectiveDurationRaw);
      currentTimeRef.current = current;
      if (effectiveDuration > 0) durationRef.current = effectiveDuration;
      setCurrentTimeSec(current);
      if (effectiveDuration > 0) setDurationSec(effectiveDuration);
    },
    [],
  );

  const handleError = useCallback((e: unknown) => {
    try {
      const inner =
        e != null &&
        typeof e === 'object' &&
        'error' in e &&
        (e as { error: unknown }).error;
      const msg =
        inner && typeof inner === 'object' && 'errorString' in inner
          ? String((inner as { errorString: unknown }).errorString)
          : 'Playback error';
      setError(msg);
    } catch {
      setError('Playback error');
    }
    setPaused(true);
  }, []);

  const seekBy = useCallback(
    (delta: number) => {
      if (!loadedRef.current) return;
      const duration = durationRef.current > 0 ? durationRef.current : durationSec;
      if (!duration || duration <= 0) return;
      const current = currentTimeRef.current || currentTimeSec;
      const next = Math.max(0, Math.min(current + delta, duration));
      const fraction = next / duration;
      try {
        (videoRef.current as any)?.seek(fraction);
      } catch {
        // ignore seek errors
      }
      currentTimeRef.current = next;
      setCurrentTimeSec(next);
    },
    [currentTimeSec, durationSec],
  );

  const formatTime = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return '0:00';
    const total = Math.floor(value);
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (loading || !movie?.streamUrl) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-950">
        {loading ? (
          <ActivityIndicator size="large" color="#a855f7" />
        ) : (
          <Text className="text-base text-slate-100">Keine Stream-URL für diesen Film.</Text>
        )}
      </View>
    );
  }


  const videoSource = {
    uri: movie.streamUrl,
  };

  const modalVisible = resumePromptVisible && initialPositionSec > 0;

  return (
    <View className="flex-1 bg-slate-950">
      <View className="flex-1 bg-black">
        <VLCPlayer
          ref={videoRef}
          source={videoSource}
          style={{ width: '100%', height: '100%' }}
          paused={paused}
          rate={1.0}
          videoAspectRatio="16:9"
          resizeMode="contain"
          autoAspectRatio
          onError={handleError}
          onProgress={(p: { currentTime: number; duration: number }) =>
            handleProgress({
              currentTime: p.currentTime,
              playableDuration: p.duration,
              seekableDuration: p.duration,
            })
          }
          onPlaying={() => {
            loadedRef.current = true;
          }}
        />
        {error && (
          <View className="absolute inset-0 items-center justify-center bg-black/75">
            <Text className="mb-3 px-6 text-center text-slate-100">
              {error}
            </Text>
            <Pressable
              onPress={() => navigation.goBack()}
              onFocus={() => setFocusedControl('back')}
              onBlur={() => setFocusedControl(null)}
              focusable
              className={`rounded-full px-5 py-2 border ${
                focusedControl === 'back'
                  ? 'bg-slate-700 border-purple-300'
                  : 'bg-slate-900 border-slate-700'
              }`}
            >
              <Text className="text-slate-100">Zurück</Text>
            </Pressable>
          </View>
        )}
      </View>

      <ResumePromptModal
        visible={modalVisible}
        positionLabel={formatTime(initialPositionSec)}
        onStartOver={() => {
          setResumePromptVisible(false);
          setInitialPositionSec(0);
          setPaused(false);
        }}
        onResume={() => {
          if (durationSec > 0 && loadedRef.current) {
            const next = Math.max(0, Math.min(initialPositionSec, durationSec));
            videoRef.current?.seek(next);
            setCurrentTimeSec(next);
          }
          setResumePromptVisible(false);
          setInitialPositionSec(0);
          setPaused(false);
        }}
        onResumeHandleChange={(h) => {
          resumeHandleRef.current = h;
        }}
      />

      {!fullscreen && (
        <View
          className="flex-row items-center justify-between border-t border-slate-900 bg-slate-950 px-6 py-3.5"
          pointerEvents={modalVisible ? 'none' : 'auto'}
        >
          <View className="flex-row items-center">
            <Pressable
              onPress={() => setPaused((p) => !p)}
              onFocus={() => setFocusedControl('play')}
              onBlur={() => setFocusedControl(null)}
              focusable={!modalVisible}
              {...(modalVisible && resumeHandleRef.current != null
                ? ({ nextFocusUp: resumeHandleRef.current } as any)
                : {})}
              className={`mr-4 h-10 w-10 items-center justify-center rounded-full border ${
                focusedControl === 'play'
                  ? 'bg-violet-50 border-purple-300'
                  : 'bg-slate-200 border-transparent'
              }`}
            >
              <MaterialCommunityIcons name={paused ? 'play' : 'pause'} size={24} color="#020617" />
            </Pressable>

            <Pressable
              onPress={() => seekBy(-10)}
              onFocus={() => setFocusedControl('rewind')}
              onBlur={() => setFocusedControl(null)}
              focusable={!modalVisible}
              {...(modalVisible && resumeHandleRef.current != null
                ? ({ nextFocusUp: resumeHandleRef.current } as any)
                : {})}
              className={`mr-3 h-10 w-10 items-center justify-center rounded-full border ${
                focusedControl === 'rewind'
                  ? 'border-purple-300'
                  : 'border-slate-600'
              }`}
            >
              <MaterialCommunityIcons name="rewind-10" size={22} color="#e5e7eb" />
            </Pressable>

            <Pressable
              onPress={() => seekBy(30)}
              onFocus={() => setFocusedControl('forward')}
              onBlur={() => setFocusedControl(null)}
              focusable={!modalVisible}
              {...(modalVisible && resumeHandleRef.current != null
                ? ({ nextFocusUp: resumeHandleRef.current } as any)
                : {})}
              className={`h-10 w-10 items-center justify-center rounded-full border ${
                focusedControl === 'forward'
                  ? 'border-purple-300'
                  : 'border-slate-600'
              }`}
            >
              <MaterialCommunityIcons name="fast-forward-30" size={22} color="#e5e7eb" />
            </Pressable>

            <Pressable
              onPress={() => setFullscreen(true)}
              onFocus={() => setFocusedControl('fullscreen')}
              onBlur={() => setFocusedControl(null)}
              focusable={!modalVisible}
              {...(modalVisible && resumeHandleRef.current != null
                ? ({ nextFocusUp: resumeHandleRef.current } as any)
                : {})}
              className={`ml-3 h-10 w-10 items-center justify-center rounded-full border ${
                focusedControl === 'fullscreen'
                  ? 'border-purple-300'
                  : 'border-slate-600'
              }`}
            >
              <MaterialCommunityIcons name="fullscreen" size={22} color="#e5e7eb" />
            </Pressable>
          </View>

          <View className="flex-row items-center">
            <Text style={{ fontVariant: ['tabular-nums'] }} className="mr-1.5 text-slate-400">
              {formatTime(currentTimeSec)}
            </Text>
            <Text className="text-slate-600">/</Text>
            <Text
              style={{ fontVariant: ['tabular-nums'] }}
              className="ml-1.5 text-slate-500"
            >
              {formatTime(durationSec)}
            </Text>
          </View>
        </View>
      )}

      {fullscreen && (
        <View className="absolute bottom-6 right-6 flex-row items-center">
          <Pressable
            onPress={() => setFullscreen(false)}
            onFocus={() => setFocusedControl('fullscreen')}
            onBlur={() => setFocusedControl(null)}
            focusable
            className={`h-11 w-11 items-center justify-center rounded-full border bg-slate-900/90 ${
              focusedControl === 'fullscreen'
                ? 'border-purple-300'
                : 'border-slate-600'
            }`}
          >
            <MaterialCommunityIcons name="fullscreen-exit" size={22} color="#e5e7eb" />
          </Pressable>
        </View>
      )}
    </View>
  );
}

