import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { findNodeHandle, Pressable, Text, View, type DimensionValue } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { PlayerOptionMenu, type PlayerOptionMenuItem } from './PlayerOptionMenu';

type FocusedButton = 'rewind' | 'play' | 'forward' | 'close' | 'next' | null;

type FullscreenPlaybackOverlayProps = {
  visible: boolean;
  title: string;
  paused: boolean;
  currentTimeLabel: string;
  durationLabel: string;
  progressPercent: number;
  onTogglePlay: () => void;
  onRewind: () => void;
  onForward: () => void;
  onExitFullscreen: () => void;
  onWake: () => void;
  onInteract: () => void;
  subtitleItems: PlayerOptionMenuItem[];
  subtitlesDisabled?: boolean;
  onSubtitleSelect: (id: string) => void;
  onOverlayLockChange?: (locked: boolean) => void;
  nextEpisodeLabel?: string | null;
  onNextEpisode?: () => void;
};

function isDirectionalWakeEvent(event: unknown) {
  const nativeEvent =
    event != null && typeof event === 'object' && 'nativeEvent' in event
      ? (event as { nativeEvent?: Record<string, unknown> }).nativeEvent
      : undefined;

  const candidates = [
    nativeEvent?.eventType,
    nativeEvent?.key,
    nativeEvent?.code,
    nativeEvent?.keyCode,
  ]
    .filter((value) => value != null)
    .map((value) => String(value).toLowerCase());

  return candidates.some((value) =>
    ['left', 'right', 'arrowleft', 'arrowright', '21', '22'].includes(value),
  );
}

export function FullscreenPlaybackOverlay({
  visible,
  title,
  paused,
  currentTimeLabel,
  durationLabel,
  progressPercent,
  onTogglePlay,
  onRewind,
  onForward,
  onExitFullscreen,
  onWake,
  onInteract,
  subtitleItems,
  subtitlesDisabled = false,
  onSubtitleSelect,
  onOverlayLockChange,
  nextEpisodeLabel,
  onNextEpisode,
}: FullscreenPlaybackOverlayProps) {
  const [focusedButton, setFocusedButton] = useState<FocusedButton>(null);
  const wakeRef = useRef<React.ElementRef<typeof Pressable>>(null);
  const rewindRef = useRef<React.ElementRef<typeof Pressable>>(null);
  const playRef = useRef<React.ElementRef<typeof Pressable>>(null);
  const forwardRef = useRef<React.ElementRef<typeof Pressable>>(null);
  const closeRef = useRef<React.ElementRef<typeof Pressable>>(null);

  const [rewindHandle, setRewindHandle] = useState<number | null>(null);
  const [playHandle, setPlayHandle] = useState<number | null>(null);
  const [forwardHandle, setForwardHandle] = useState<number | null>(null);
  const [closeHandle, setCloseHandle] = useState<number | null>(null);
  const captureHandle = useCallback(
    (
      setter: React.Dispatch<React.SetStateAction<number | null>>,
      node: React.ElementRef<typeof Pressable> | null,
    ) => {
      setter(node ? findNodeHandle(node) : null);
    },
    [],
  );

  useEffect(() => {
    const timeoutMs = visible ? 80 : 40;
    const id = setTimeout(() => {
      const target = visible ? playRef.current : wakeRef.current;
      (target as unknown as { focus?: () => void })?.focus?.();
    }, timeoutMs);
    return () => clearTimeout(id);
  }, [visible]);

  const progressWidth = useMemo(
    () => `${Math.max(0, Math.min(100, progressPercent))}%` as DimensionValue,
    [progressPercent],
  );

  const controlButtonClassName = useCallback(
    (isFocused: boolean, isPrimary = false) =>
      `h-16 w-16 items-center justify-center rounded-full border ${
        isFocused
          ? 'border-cyan-300 bg-cyan-300/20'
          : isPrimary
            ? 'border-slate-200/40 bg-slate-100/10'
            : 'border-slate-500/40 bg-slate-950/55'
      }`,
    [],
  );

  const hiddenOverlayKeyHandlers = useMemo(
    () =>
      ({
        onKeyDown: (
          event: {
            nativeEvent?: Record<string, unknown>;
            preventDefault?: () => void;
            stopPropagation?: () => void;
          },
        ) => {
          if (!isDirectionalWakeEvent(event)) {
            return;
          }
          onWake();
          event?.preventDefault?.();
          event?.stopPropagation?.();
        },
      } as const),
    [onWake],
  );

  if (!visible) {
    return (
      <Pressable
        ref={wakeRef}
        onPress={onWake}
        onFocus={() => setFocusedButton(null)}
        focusable
        hasTVPreferredFocus
        className="absolute inset-0"
        {...(hiddenOverlayKeyHandlers as any)}
      />
    );
  }

  return (
    <View className="absolute inset-0 bg-black/25" pointerEvents="box-none">
      <View className="absolute left-8 top-8 max-w-[72%] rounded-3xl bg-slate-950/70 px-5 py-4">
        <Text className="text-xs uppercase tracking-[2px] text-cyan-200/80">Now Playing</Text>
        <Text className="mt-2 text-2xl font-semibold text-slate-50" numberOfLines={2}>
          {title}
        </Text>
      </View>

      <View className="absolute inset-x-0 top-[38%] items-center" pointerEvents="box-none">
        <View className="flex-row items-center justify-center">
          <Pressable
            ref={(node) => {
              rewindRef.current = node;
              captureHandle(setRewindHandle, node);
            }}
            onPress={() => {
              onInteract();
              onRewind();
            }}
            onFocus={() => {
              setFocusedButton('rewind');
              onInteract();
            }}
            onBlur={() => setFocusedButton(null)}
            focusable
            className={controlButtonClassName(focusedButton === 'rewind')}
            {...(
              playHandle != null && closeHandle != null
                ? ({
                    nextFocusRight: playHandle,
                    nextFocusDown: closeHandle,
                  } as any)
                : {}
            )}
          >
            <MaterialCommunityIcons name="rewind-10" size={28} color="#e2e8f0" />
          </Pressable>

          <Pressable
            ref={(node) => {
              playRef.current = node;
              captureHandle(setPlayHandle, node);
            }}
            onPress={() => {
              onInteract();
              onTogglePlay();
            }}
            onFocus={() => {
              setFocusedButton('play');
              onInteract();
            }}
            onBlur={() => setFocusedButton(null)}
            focusable
            hasTVPreferredFocus
            className={`mx-6 ${controlButtonClassName(focusedButton === 'play', true)}`}
            {...(
              rewindHandle != null && forwardHandle != null && closeHandle != null
                ? ({
                    nextFocusLeft: rewindHandle,
                    nextFocusRight: forwardHandle,
                    nextFocusDown: closeHandle,
                  } as any)
                : {}
            )}
          >
            <MaterialCommunityIcons
              name={paused ? 'play' : 'pause'}
              size={32}
              color="#f8fafc"
            />
          </Pressable>

          <Pressable
            ref={(node) => {
              forwardRef.current = node;
              captureHandle(setForwardHandle, node);
            }}
            onPress={() => {
              onInteract();
              onForward();
            }}
            onFocus={() => {
              setFocusedButton('forward');
              onInteract();
            }}
            onBlur={() => setFocusedButton(null)}
            focusable
            className={controlButtonClassName(focusedButton === 'forward')}
            {...(
              playHandle != null && closeHandle != null
                ? ({
                    nextFocusLeft: playHandle,
                    nextFocusDown: closeHandle,
                  } as any)
                : {}
            )}
          >
            <MaterialCommunityIcons name="fast-forward-30" size={28} color="#e2e8f0" />
          </Pressable>
        </View>
      </View>

      <View className="absolute bottom-8 left-8 right-8 flex-row items-end" pointerEvents="box-none">
        <View className="mr-5 flex-1 rounded-[28px] bg-slate-950/72 px-6 py-5">
          <View className="mb-3 flex-row items-center justify-between">
            <Text
              style={{ fontVariant: ['tabular-nums'] }}
              className="text-sm font-medium text-slate-100"
            >
              {currentTimeLabel}
            </Text>
            <Text
              style={{ fontVariant: ['tabular-nums'] }}
              className="text-sm text-slate-400"
            >
              {durationLabel}
            </Text>
          </View>

          <View className="h-2 overflow-hidden rounded-full bg-slate-800">
            <View className="h-full rounded-full bg-cyan-300" style={{ width: progressWidth }} />
          </View>
        </View>

        <View className="flex-row items-center">
          <View className="mr-3">
            <PlayerOptionMenu
              title="Subtitles"
              triggerLabel="CC"
              items={subtitleItems}
              disabled={subtitlesDisabled}
              onSelect={onSubtitleSelect}
              onOpenChange={onOverlayLockChange}
              onInteract={onInteract}
            />
          </View>

          {nextEpisodeLabel && onNextEpisode && (
            <Pressable
              onPress={() => {
                onInteract();
                onNextEpisode();
              }}
              onFocus={() => {
                setFocusedButton('next');
                onInteract();
              }}
              onBlur={() => setFocusedButton(null)}
              focusable
              className={`mr-3 rounded-full bg-slate-950/72 px-5 py-3 ${
                focusedButton === 'next' ? 'border border-cyan-300' : ''
              }`}
              {...(playHandle != null ? ({ nextFocusUp: playHandle } as any) : {})}
            >
              <View className="flex-row items-center">
                <Text className="text-xs uppercase tracking-[2px] text-slate-400">
                  Next Episode
                </Text>
                <View className="ml-1.5">
                  <MaterialCommunityIcons name="arrow-right" size={16} color="#94a3b8" />
                </View>
              </View>
              <Text className="mt-1 text-sm font-medium text-slate-100">{nextEpisodeLabel}</Text>
            </Pressable>
          )}

          <Pressable
            ref={(node) => {
              closeRef.current = node;
              captureHandle(setCloseHandle, node);
            }}
            onPress={() => {
              onInteract();
              onExitFullscreen();
            }}
            onFocus={() => {
              setFocusedButton('close');
              onInteract();
            }}
            onBlur={() => setFocusedButton(null)}
            focusable
            className={`h-14 w-14 items-center justify-center rounded-full ${
              focusedButton === 'close' ? 'border border-cyan-300 bg-cyan-300/20' : 'bg-slate-950/72'
            }`}
            {...(playHandle != null ? ({ nextFocusUp: playHandle } as any) : {})}
          >
            <MaterialCommunityIcons name="fullscreen-exit" size={24} color="#e2e8f0" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
