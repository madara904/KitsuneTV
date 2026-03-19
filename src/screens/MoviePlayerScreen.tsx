import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  Text,
  View,
} from 'react-native';
import { VLCPlayer } from 'react-native-vlc-media-player';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { mediaService } from '../services/mediaService';
import { watchProgressRepo } from '../db/repositories/watchProgressRepo';
import type { Movie } from '../lib/types';
import { ResumePromptModal } from '../components/common/ResumePromptModal';
import { FullscreenPlaybackOverlay } from '../components/player/FullscreenPlaybackOverlay';
import type { PlayerOptionMenuItem } from '../components/player/PlayerOptionMenu';

const SAVE_INTERVAL_MS = 8000;
const MIN_RESUME_SEC = 3;
const PROGRESS_UI_UPDATE_MS = 1000;
const VLC_PROGRESS_SCALE = 1000;
const FULLSCREEN_CONTROLS_HIDE_DELAY_MS = 3000;
const VLC_PROGRESS_UPDATE_INTERVAL_MS = 500;

type FocusedControl = 'play' | 'rewind' | 'forward' | 'fullscreen' | 'back' | null;
type AudioTrackInfo = { id: number; name: string };
type TextTrackInfo = { id: number; name: string };
type EpisodeQueueItem = {
  movieId: string;
  episodeId: string;
  streamUrlOverride: string;
  titleOverride: string;
};
type PlayerLoadEvent = {
  duration?: number;
  audioTracks?: AudioTrackInfo[];
  textTracks?: TextTrackInfo[];
  videoSize?: { width?: number; height?: number };
};

export function MoviePlayerScreen({ route, navigation }: any) {
  const {
    movieId,
    episodeId,
    streamUrlOverride,
    titleOverride,
    episodeQueue,
  }: {
    movieId?: string;
    episodeId?: string;
    streamUrlOverride?: string;
    titleOverride?: string;
    episodeQueue?: EpisodeQueueItem[] | null;
  } = route.params ?? {};
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
  const [audioTrackId, setAudioTrackId] = useState<number | undefined>(undefined);
  const [textTracks, setTextTracks] = useState<TextTrackInfo[]>([]);
  const [textTrackId, setTextTrackId] = useState<number | undefined>(undefined);
  const [fullscreenControlsVisible, setFullscreenControlsVisible] = useState(false);
  const [fullscreenControlsTick, setFullscreenControlsTick] = useState(0);
  const [fullscreenOverlayLocked, setFullscreenOverlayLocked] = useState(false);
  const [loadedVideoSize, setLoadedVideoSize] = useState<{ width: number; height: number } | null>(
    null,
  );

  const videoRef = useRef<any>(null);
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fullscreenControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef = useRef(false);
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);
  const resumeHandleRef = useRef<number | null>(null);
  const pendingSeekSecRef = useRef<number | null>(null);
  const lastProgressUiUpdateRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (isSeriesEpisode) {
          if (!movieId || !episodeId || !streamUrlOverride) {
            if (!cancelled) setMovie(null);
            return;
          }
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
          if (!movieId) {
            if (!cancelled) setMovie(null);
            return;
          }
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
        if (!fullscreenControlsVisible) {
          setFullscreenControlsVisible(true);
          return true;
        }
        setFullscreen(false);
        return true;
      }
      navigation.goBack();
      return true;
    });
    return () => sub.remove();
  }, [navigation, fullscreen, fullscreenControlsVisible]);

  const clearFullscreenControlsTimer = useCallback(() => {
    if (fullscreenControlsTimerRef.current) {
      clearTimeout(fullscreenControlsTimerRef.current);
      fullscreenControlsTimerRef.current = null;
    }
  }, []);

  const showFullscreenControls = useCallback(() => {
    clearFullscreenControlsTimer();
    setFullscreenControlsVisible(true);
    setFullscreenControlsTick((value) => value + 1);
  }, [clearFullscreenControlsTimer]);

  const handleProgress = useCallback(
    (e: Readonly<{ currentTime: number; playableDuration: number; seekableDuration: number }>) => {
      const current = e.currentTime / VLC_PROGRESS_SCALE;
      const effectiveDurationRaw =
        e.seekableDuration > 0 ? e.seekableDuration : e.playableDuration;
      const effectiveDuration = effectiveDurationRaw / VLC_PROGRESS_SCALE;
      currentTimeRef.current = current;
      if (effectiveDuration > 0) durationRef.current = effectiveDuration;

      const now = Date.now();
      if (
        now - lastProgressUiUpdateRef.current < PROGRESS_UI_UPDATE_MS &&
        Math.abs(current - currentTimeSec) < 1 &&
        Math.abs(effectiveDuration - durationSec) < 1
      ) {
        return;
      }

      lastProgressUiUpdateRef.current = now;
      setCurrentTimeSec(current);
      if (effectiveDuration > 0) setDurationSec(effectiveDuration);
    },
    [currentTimeSec, durationSec],
  );

  const seekToTime = useCallback((targetSec: number) => {
    const duration = durationRef.current > 0 ? durationRef.current : durationSec;
    if (!loadedRef.current || duration <= 0) {
      pendingSeekSecRef.current = targetSec;
      return false;
    }

    const next = Math.max(0, Math.min(targetSec, duration));
    try {
      (videoRef.current as any)?.seek(next / duration);
      currentTimeRef.current = next;
      setCurrentTimeSec(next);
      pendingSeekSecRef.current = null;
      return true;
    } catch {
      pendingSeekSecRef.current = next;
      return false;
    }
  }, [durationSec]);

  const applyPendingSeek = useCallback(() => {
    const pendingSeek = pendingSeekSecRef.current;
    if (pendingSeek == null) return;
    seekToTime(pendingSeek);
  }, [seekToTime]);

  const handleError = useCallback(
    (e: unknown) => {
      let msg = 'Playback error';
      try {
        const inner =
          e != null &&
          typeof e === 'object' &&
          'error' in e &&
          (e as { error: unknown }).error;
        msg =
          inner && typeof inner === 'object' && 'errorString' in inner
            ? String((inner as { errorString: unknown }).errorString)
            : msg;
      } catch {
        // ignore parsing errors, keep generic msg
      }

      // Spezieller VLC-Bug: "can't get VLCObject instance" → Screen hart schließen
      if (msg.toLowerCase().includes("can't get vlcobject") || msg.toLowerCase().includes('vlcobject')) {
        loadedRef.current = false;
        pendingSeekSecRef.current = null;
        setError(null);
        setPaused(true);
        navigation.goBack();
        return;
      }

      setError(msg);
      setPaused(true);
      loadedRef.current = false;
      pendingSeekSecRef.current = null;
    },
    [navigation],
  );

  const seekBy = useCallback(
    (delta: number) => {
      if (!loadedRef.current) return;
      const duration = durationRef.current > 0 ? durationRef.current : durationSec;
      if (!duration || duration <= 0) return;
      const current = currentTimeRef.current || currentTimeSec;
      const next = Math.max(0, Math.min(current + delta, duration));
      seekToTime(next);
    },
    [currentTimeSec, durationSec, seekToTime],
  );

  const handlePlayerReady = useCallback((event?: PlayerLoadEvent) => {
    loadedRef.current = true;
    setError(null);

    const w = event?.videoSize?.width;
    const h = event?.videoSize?.height;
    if (typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0) {
      setLoadedVideoSize({ width: w, height: h });
    }

    if (__DEV__) {
      console.log('[MoviePlayerScreen][VLC onLoad]', {
        movieId,
        episodeId,
        streamUrl: movie?.streamUrl,
        durationRaw: event?.duration,
        durationSec: event?.duration ? event.duration / VLC_PROGRESS_SCALE : 0,
        videoSize: event?.videoSize ?? null,
        audioTracks: event?.audioTracks ?? [],
        textTracks: event?.textTracks ?? [],
        selectedAudioTrackId: audioTrackId ?? null,
        selectedTextTrackId: textTrackId ?? null,
      });
    }

    const duration = event?.duration ? event.duration / VLC_PROGRESS_SCALE : 0;
    if (duration > 0) {
      durationRef.current = duration;
      setDurationSec((prev) => (Math.abs(prev - duration) >= 1 ? duration : prev));
    }

    if (audioTrackId == null && event?.audioTracks?.length === 1) {
      const singleTrack = event.audioTracks[0];
      if (singleTrack && singleTrack.id >= 0) {
        setAudioTrackId(singleTrack.id);
      }
    }

    setTextTracks(event?.textTracks ?? []);
    if (textTrackId == null && event?.textTracks?.some((track) => track.id < 0)) {
      const disabledTrack = event.textTracks.find((track) => track.id < 0);
      setTextTrackId(disabledTrack?.id);
    }

    applyPendingSeek();
  }, [applyPendingSeek, audioTrackId, episodeId, movie?.streamUrl, movieId, textTrackId]);

  const formatTime = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return '0:00';
    const total = Math.floor(value);
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const initOptions = useMemo(
    () => [
      '--network-caching=2000',
      '--live-caching=2500',
      '--file-caching=2000',
      '--http-reconnect',
    ],
    [],
  );

  const videoSource = useMemo(() => ({
    uri: movie?.streamUrl ?? '',
    initType: 2 as const,
    initOptions: [...initOptions],
  }), [movie?.streamUrl, initOptions]);

  const nextEpisode = useMemo(() => {
    if (!episodeId || !episodeQueue?.length) return null;
    const currentIndex = episodeQueue.findIndex((item) => item.episodeId === episodeId);
    return currentIndex >= 0 ? episodeQueue[currentIndex + 1] ?? null : null;
  }, [episodeId, episodeQueue]);

  const modalVisible = resumePromptVisible && initialPositionSec > 0;

  useEffect(() => {
    loadedRef.current = false;
    currentTimeRef.current = 0;
    durationRef.current = 0;
    pendingSeekSecRef.current = null;
    lastProgressUiUpdateRef.current = 0;
    setCurrentTimeSec(0);
    setDurationSec(0);
    setError(null);
    setAudioTrackId(undefined);
    setTextTracks([]);
    setTextTrackId(undefined);
    setFullscreenControlsVisible(false);
    setFullscreenOverlayLocked(false);
    setLoadedVideoSize(null);
  }, [movie?.streamUrl]);
  
  useEffect(() => {
    if (!fullscreen || modalVisible || !!error || fullscreenOverlayLocked) {
      clearFullscreenControlsTimer();
      if (!fullscreen) {
        setFullscreenControlsVisible(false);
      }
      return;
    }

    if (!fullscreenControlsVisible) {
      clearFullscreenControlsTimer();
      return;
    }

    clearFullscreenControlsTimer();
    fullscreenControlsTimerRef.current = setTimeout(() => {
      setFullscreenControlsVisible(false);
    }, FULLSCREEN_CONTROLS_HIDE_DELAY_MS);

    return clearFullscreenControlsTimer;
  }, [
    clearFullscreenControlsTimer,
    error,
    fullscreen,
    fullscreenOverlayLocked,
    fullscreenControlsTick,
    fullscreenControlsVisible,
    modalVisible,
  ]);

  useEffect(() => {
    if (fullscreen) {
      setFullscreenControlsVisible(true);
    } else {
      setFullscreenOverlayLocked(false);
    }
  }, [fullscreen]);

  const forceSingleImage = useMemo(() => {
    // This mode intentionally crops to the left "eye" for SBS 3D sources (200% width).
    // It must be conservative; false positives look like a horizontally shifted video.
    const candidate = `${titleOverride ?? ''} ${movie?.name ?? ''}`.toLowerCase();
    const titleSuggests3dSbs =
      /\b3d\b/.test(candidate) ||
      /\bhsbs\b/.test(candidate) ||
      /\bsbs\b/.test(candidate) ||
      /side[- ]by[- ]side/.test(candidate);

    const ratio =
      loadedVideoSize && loadedVideoSize.height > 0
        ? loadedVideoSize.width / loadedVideoSize.height
        : null;
    const looksLikeSbsByGeometry = ratio != null && ratio >= 2.6;

    return titleSuggests3dSbs && looksLikeSbsByGeometry;
  }, [loadedVideoSize, movie?.name, titleOverride]);

  const subtitleMenuItems = useMemo<PlayerOptionMenuItem[]>(() => {
    const items: PlayerOptionMenuItem[] = [
      {
        id: 'off',
        label: 'Untertitel aus',
        selected: textTrackId == null || textTrackId < 0,
      },
    ];

    for (const track of textTracks) {
      if (track.id < 0) continue;
      items.push({
        id: String(track.id),
        label: track.name,
        selected: textTrackId === track.id,
      });
    }

    if (items.length === 1) {
      items.push({
        id: 'unavailable',
        label: 'Keine Untertitel verfuegbar',
        disabled: true,
      });
    }

    return items;
  }, [textTrackId, textTracks]);

  const playerViewportContainerStyle = useMemo(
    () =>
      forceSingleImage
        ? ({
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            overflow: 'hidden',
          } as const)
        : ({ width: '100%', height: '100%' } as const),
    [forceSingleImage],
  );

  const playerViewportContentStyle = useMemo(
    () =>
      forceSingleImage
        ? ({
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: '200%',
            height: '100%',
          } as const)
        : ({ width: '100%', height: '100%' } as const),
    [forceSingleImage],
  );

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

  const playbackTitle = titleOverride || movie?.name || 'Playback';
  const progressPercent = durationSec > 0 ? (currentTimeSec / durationSec) * 100 : 0;
  const nextEpisodeLabel = nextEpisode?.titleOverride ?? null;

  return (
    <View className="flex-1 bg-slate-950">
      <View className="flex-1 bg-black">
        <View className="flex-1 overflow-hidden bg-black">
          <View style={playerViewportContainerStyle}>
            <View style={playerViewportContentStyle}>
              <VLCPlayer
                key={movie.streamUrl}
                ref={videoRef}
                {...({
                  source: videoSource,
                  style: { width: '100%', height: '100%' },
                  paused,
                  rate: 1.0,
                  audioTrack: audioTrackId,
                  textTrack: textTrackId,
                  videoAspectRatio: forceSingleImage ? '32:9' as const : '16:9' as const,
                  autoAspectRatio: !forceSingleImage,
                  progressUpdateInterval: VLC_PROGRESS_UPDATE_INTERVAL_MS,
                  onError: handleError,
                  onProgress: (p: { currentTime: number; duration: number }) =>
                    handleProgress({
                      currentTime: p.currentTime,
                      playableDuration: p.duration,
                      seekableDuration: p.duration,
                    }),
                  onLoad: handlePlayerReady,
                  onPlaying: handlePlayerReady,
                } as any)}
              />
            </View>
          </View>
        </View>
        {fullscreen && !error && !modalVisible && (
          <FullscreenPlaybackOverlay
            visible={fullscreenControlsVisible}
            title={playbackTitle}
            paused={paused}
            currentTimeLabel={formatTime(currentTimeSec)}
            durationLabel={formatTime(durationSec)}
            progressPercent={progressPercent}
            onTogglePlay={() => setPaused((value) => !value)}
            onRewind={() => seekBy(-10)}
            onForward={() => seekBy(30)}
            onExitFullscreen={() => setFullscreen(false)}
            onWake={showFullscreenControls}
            onInteract={showFullscreenControls}
            subtitleItems={subtitleMenuItems}
            subtitlesDisabled={false}
            onSubtitleSelect={(id) => {
              if (id === 'off') {
                setTextTrackId(undefined);
                return;
              }
              if (id === 'unavailable') return;
              setTextTrackId(Number(id));
            }}
            onOverlayLockChange={setFullscreenOverlayLocked}
            nextEpisodeLabel={nextEpisodeLabel}
            onNextEpisode={
              nextEpisode
                ? () => {
                    saveProgress(currentTimeRef.current, durationRef.current);
                    navigation.replace('MoviePlayer', {
                      movieId: nextEpisode.movieId,
                      episodeId: nextEpisode.episodeId,
                      streamUrlOverride: nextEpisode.streamUrlOverride,
                      titleOverride: nextEpisode.titleOverride,
                      episodeQueue,
                    });
                  }
                : undefined
            }
          />
        )}
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
          pendingSeekSecRef.current = initialPositionSec;
          applyPendingSeek();
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

    </View>
  );
}
