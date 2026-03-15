/**
 * PlayerColumn.tsx — Android TV / React Native TV player
 *
 * Fullscreen state machine:
 *   CONTROLS_VISIBLE ──(3s idle)──► CONTROLS_HIDDEN
 *        ▲                               │
 *        └──────── OK on overlay ────────┘
 *
 * • Controls bar never unmounts — opacity + pointerEvents only (avoids "section doesn't appear").
 * • Overlay focus-trap (nextFocus* to self) when controls hidden prevents focus leaking to channel list.
 * • Programmatic .focus() after state change so Play button or overlay has focus.
 */

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  BackHandler,
  findNodeHandle,
  Platform,
  Pressable,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import Video, { type VideoRef } from 'react-native-video';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { usePlayer } from '../../context/PlayerContext';
import { recentRepo } from '../../db/repositories/recentRepo';

const PLAYER_WIDTH = 380;
const CONTROLS_HIDE_DELAY_MS = 3000;
/** Android TV: focus only works after view is mounted; try several delays including longer ones */
const FOCUS_DELAYS_MS = Platform.OS === 'android' ? [0, 100, 250, 500, 800] : [50];

type FocusedBtn = 'play' | 'fullscreen' | 'close' | 'error-close' | null;

// ─── Error Boundary ───────────────────────────────────────────────────────────

class PlayerErrorBoundary extends React.Component<
  { children: React.ReactNode; onReset: () => void },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: '' };

  static getDerivedStateFromError(err: unknown) {
    return {
      hasError: true,
      message: err instanceof Error ? err.message : String(err),
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: '#000',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
        >
          <Text
            style={{ color: '#ef4444', textAlign: 'center', marginBottom: 16 }}
          >
            Player abgestürzt. {this.state.message}
          </Text>
          <Pressable
            onPress={() => {
              this.setState({ hasError: false, message: '' });
              this.props.onReset();
            }}
            style={{
              paddingHorizontal: 24,
              paddingVertical: 12,
              backgroundColor: '#8b5cf6',
              borderRadius: 8,
            }}
          >
            <Text style={{ color: '#fff' }}>Schließen & neu wählen</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

// ─── Hook: Fullscreen controls visibility ──────────────────────────────────────

function useControlsVisibility(active: boolean) {
  const [controlsVisible, setControlsVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    clearTimer();
    timerRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, CONTROLS_HIDE_DELAY_MS);
  }, [clearTimer]);

  useEffect(() => {
    if (!active) {
      clearTimer();
      setControlsVisible(true);
      return;
    }
    showControls();
    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when fullscreen active
  }, [active]);

  return { controlsVisible, showControls };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PlayerColumn() {
  const {
    currentChannel,
    setCurrentChannel,
    fullscreen,
    setFullscreen,
    setPlayerFocusNodeHandle,
    setPlayerControlsFocused,
  } = usePlayer();

  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [focusedBtn, setFocusedBtn] = useState<FocusedBtn>(null);

  const { controlsVisible, showControls } = useControlsVisibility(
    fullscreen && !!currentChannel,
  );

  const playBtnRef = useRef<View>(null);
  const fullscreenBtnRef = useRef<View>(null);
  const closeBtnRef = useRef<View>(null);
  const overlayRef = useRef<View | null>(null);
  const fullscreenContainerRef = useRef<View>(null);
  const placeholderRef = useRef<View>(null);
  const videoRef = useRef<VideoRef>(null);

  const [overlayHandle, setOverlayHandle] = useState<number | null>(null);
  const [playHandle, setPlayHandle] = useState<number | null>(null);
  const [fullscreenHandle, setFullscreenHandle] = useState<number | null>(null);
  const [closeHandle, setCloseHandle] = useState<number | null>(null);

  const captureOverlayRef = useCallback((node: View | null) => {
    overlayRef.current = node;
    setOverlayHandle(node ? findNodeHandle(node) : null);
  }, []);
  const capturePlayRef = useCallback((node: View | null) => {
    (playBtnRef as React.MutableRefObject<View | null>).current = node;
    setPlayHandle(node ? findNodeHandle(node) : null);
  }, []);
  const captureFullscreenRef = useCallback((node: View | null) => {
    (fullscreenBtnRef as React.MutableRefObject<View | null>).current = node;
    setFullscreenHandle(node ? findNodeHandle(node) : null);
  }, []);
  const captureCloseRef = useCallback((node: View | null) => {
    (closeBtnRef as React.MutableRefObject<View | null>).current = node;
    setCloseHandle(node ? findNodeHandle(node) : null);
  }, []);

  const captureFullscreenContainerRef = useCallback((node: View | null) => {
    (fullscreenContainerRef as React.MutableRefObject<View | null>).current = node;
  }, []);

  // Back: when controls hidden, show them first; when visible, exit fullscreen (so OK/Leertaste don't exit)
  useEffect(() => {
    if (!fullscreen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!controlsVisible) {
        showControls();
        return true;
      }
      setFullscreen(false);
      return true;
    });
    return () => sub.remove();
  }, [fullscreen, controlsVisible, showControls, setFullscreen]);

  // iOS: AccessibilityInfo works. Android: setAccessibilityFocus is no-op; we rely on render order (controls first) + hasTVPreferredFocus
  const focusPlayButton = useCallback(() => {
    const ids = FOCUS_DELAYS_MS.map((delay) =>
      setTimeout(() => {
        const node = (playBtnRef as React.MutableRefObject<View | null>).current;
        const tag = findNodeHandle(node);
        if (tag != null && Platform.OS === 'ios') {
          AccessibilityInfo.setAccessibilityFocus(tag);
        }
        (node as unknown as { focus?: () => void })?.focus?.();
      }, delay),
    );
    return () => ids.forEach((id) => clearTimeout(id));
  }, []);
  // When controls hidden, focus the overlay so OK/Enter/Leertaste trigger onPress → showControls
  const focusOverlay = useCallback(() => {
    const ids = FOCUS_DELAYS_MS.map((delay) =>
      setTimeout(() => {
        const node = overlayRef.current;
        const tag = findNodeHandle(node);
        if (tag != null && Platform.OS === 'ios') {
          AccessibilityInfo.setAccessibilityFocus(tag);
        }
        (node as unknown as { focus?: () => void })?.focus?.();
      }, delay),
    );
    return () => ids.forEach((id) => clearTimeout(id));
  }, []);

  // When entering fullscreen, pull focus to play button (Layout is unmounted so only player exists)
  useEffect(() => {
    if (!fullscreen) return;
    const cleanup = focusPlayButton();
    return cleanup;
  }, [fullscreen, focusPlayButton]);

  // When controls visibility toggles in fullscreen: focus play button or overlay (overlay onPress = OK/Leertaste shows controls)
  useEffect(() => {
    if (!fullscreen) return;
    const cleanup = controlsVisible ? focusPlayButton() : focusOverlay();
    return cleanup;
  }, [controlsVisible, fullscreen, focusPlayButton, focusOverlay]);

  useLayoutEffect(() => {
    if (fullscreen) {
      setPlayerFocusNodeHandle(null);
      return () => setPlayerFocusNodeHandle(null);
    }
    const el = currentChannel ? playBtnRef.current : placeholderRef.current;
    setPlayerFocusNodeHandle(findNodeHandle(el));
    return () => setPlayerFocusNodeHandle(null);
  }, [currentChannel, fullscreen, setPlayerFocusNodeHandle]);

  useEffect(() => {
    if (!currentChannel?.id) return;
    const t = setTimeout(() => recentRepo.add(currentChannel.id), 500);
    return () => clearTimeout(t);
  }, [currentChannel?.id]);

  const handlePlayerError = useCallback((e: unknown) => {
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

  if (!currentChannel) {
    return (
      <View
        style={{
          width: PLAYER_WIDTH,
          backgroundColor: '#0e0e12',
          borderLeftWidth: 1,
          borderLeftColor: '#282832',
          alignSelf: 'stretch',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Pressable
          ref={placeholderRef}
          focusable
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <MaterialCommunityIcons name="television-play" size={48} color="#3f3f46" />
        <Text style={{ color: '#71717a', marginTop: 8, textAlign: 'center', paddingHorizontal: 16 }}>
          Kanal wählen
        </Text>
      </View>
    );
  }

  const containerStyle: ViewStyle = fullscreen
    ? {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999,
        backgroundColor: '#000',
      }
    : {
        width: PLAYER_WIDTH,
        backgroundColor: '#000',
        borderLeftWidth: 1,
        borderLeftColor: '#282832',
        alignSelf: 'stretch',
      };

  const controlsBarStyle: ViewStyle = {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    opacity: !fullscreen || controlsVisible ? 1 : 0,
    pointerEvents: !fullscreen || controlsVisible ? 'auto' : 'none',
  };

  const btnStyle = (focused: boolean): ViewStyle => ({
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: focused ? 3 : 0,
    borderColor: '#d8b4fe',
  });

  // v6 API: source holds uri + bufferConfig (bufferConfig prop is deprecated)
  const videoSource = {
    uri: currentChannel.streamUrl,
    bufferConfig: {
      minBufferMs: 8000,
      maxBufferMs: 25000,
      bufferForPlaybackMs: 2500,
      bufferForPlaybackAfterRebufferMs: 5000,
    },
  };

  // v6 docs: focusable=false so Video never steals TV focus; controls=false we use custom UI
  const videoProps = {
    ref: videoRef,
    source: videoSource,
    style: { flex: 1, width: '100%' as const },
    resizeMode: 'contain' as const,
    paused: paused || !!error,
    rate: 1.0,
    progressUpdateInterval: 1000,
    useTextureView: true,
    onError: handlePlayerError,
    onLoad: () => setError(null),
    focusable: false,
    controls: false,
    preventsDisplaySleepDuringVideoPlayback: true,
  };

  const errorOverlay = (
    <>
      {error && (
        <View
          style={{
            position: 'absolute',
            inset: 0,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.8)',
          }}
        >
          <Text style={{ color: '#f87171', marginBottom: 16, textAlign: 'center', paddingHorizontal: 16 }}>
            {error}
          </Text>
          <Pressable
            focusable
            onPress={() => setCurrentChannel(null)}
            onFocus={() => setFocusedBtn('error-close')}
            onBlur={() => setFocusedBtn(null)}
            style={btnStyle(focusedBtn === 'error-close')}
          >
            <Text style={{ color: '#fff' }}>Schließen</Text>
          </Pressable>
        </View>
      )}
    </>
  );

  const controlsBar = (
    <View style={controlsBarStyle} focusable={false}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 12,
          backgroundColor: 'rgba(0,0,0,0.7)',
        }}
        focusable={false}
      >
        <Text style={{ color: '#fff', fontSize: 14, flex: 1 }} numberOfLines={1}>
          {currentChannel.name}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }} focusable={false}>
          <Pressable
            ref={capturePlayRef}
            hasTVPreferredFocus={fullscreen}
            focusable={!fullscreen || controlsVisible}
            onPress={() => {
              setPaused((p) => !p);
              if (fullscreen) showControls();
            }}
            onFocus={() => {
              setFocusedBtn('play');
              setPlayerControlsFocused(true);
              if (fullscreen) showControls();
            }}
            onBlur={() => { setFocusedBtn(null); setPlayerControlsFocused(false); }}
            style={btnStyle(focusedBtn === 'play')}
            {...(fullscreen && controlsVisible && playHandle != null && fullscreenHandle != null && closeHandle != null
              ? ({
                  nextFocusRight: fullscreenHandle,
                  nextFocusLeft: closeHandle,
                  nextFocusUp: playHandle,
                  nextFocusDown: playHandle,
                } as Record<string, number>)
              : {})}
          >
            <MaterialCommunityIcons name={paused ? 'play' : 'pause'} size={24} color="#fff" />
          </Pressable>
          <Pressable
            ref={captureFullscreenRef}
            focusable={!fullscreen || controlsVisible}
            onPress={() => {
              setFullscreen(!fullscreen);
              if (fullscreen) showControls();
            }}
            onFocus={() => {
              setFocusedBtn('fullscreen');
              setPlayerControlsFocused(true);
              if (fullscreen) showControls();
            }}
            onBlur={() => { setFocusedBtn(null); setPlayerControlsFocused(false); }}
            style={btnStyle(focusedBtn === 'fullscreen')}
            {...(fullscreen && controlsVisible && playHandle != null && fullscreenHandle != null && closeHandle != null
              ? ({
                  nextFocusLeft: playHandle,
                  nextFocusRight: closeHandle,
                  nextFocusUp: fullscreenHandle,
                  nextFocusDown: fullscreenHandle,
                } as Record<string, number>)
              : {})}
          >
            <MaterialCommunityIcons
              name={fullscreen ? 'fullscreen-exit' : 'fullscreen'}
              size={22}
              color="#fff"
            />
          </Pressable>
          <Pressable
            ref={captureCloseRef}
            focusable={!fullscreen || controlsVisible}
            onPress={() => setCurrentChannel(null)}
            onFocus={() => {
              setFocusedBtn('close');
              setPlayerControlsFocused(true);
              if (fullscreen) showControls();
            }}
            onBlur={() => { setFocusedBtn(null); setPlayerControlsFocused(false); }}
            style={btnStyle(focusedBtn === 'close')}
            {...(fullscreen && controlsVisible && playHandle != null && fullscreenHandle != null && closeHandle != null
              ? ({
                  nextFocusLeft: fullscreenHandle,
                  nextFocusRight: playHandle,
                  nextFocusUp: closeHandle,
                  nextFocusDown: closeHandle,
                } as Record<string, number>)
              : {})}
          >
            <MaterialCommunityIcons name="close" size={22} color="#fff" />
          </Pressable>
        </View>
      </View>
    </View>
  );

  const fullscreenOverlay = fullscreen ? (
    <Pressable
      ref={captureOverlayRef}
      focusable={!controlsVisible}
      onPress={showControls}
      {...(!controlsVisible && {
        onKeyDown: (e: { preventDefault?: () => void; stopPropagation?: () => void }) => {
          showControls();
          e?.preventDefault?.();
          e?.stopPropagation?.();
        },
      } as Record<string, unknown>)}
      {...(overlayHandle != null && !controlsVisible
        ? ({
            nextFocusUp: overlayHandle,
            nextFocusDown: overlayHandle,
            nextFocusLeft: overlayHandle,
            nextFocusRight: overlayHandle,
          } as Record<string, number>)
        : {})}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'transparent',
        zIndex: controlsVisible ? -1 : 1,
      }}
    />
  ) : null;

  return (
    <PlayerErrorBoundary onReset={() => setCurrentChannel(null)}>
      <View
        ref={captureFullscreenContainerRef}
        style={containerStyle}
        focusable={false}
      >
        {fullscreen ? (
          controlsVisible ? (
            <>
              {controlsBar}
              {fullscreenOverlay}
              <Video {...videoProps} />
              {errorOverlay}
            </>
          ) : (
            <>
              {fullscreenOverlay}
              {controlsBar}
              <Video {...videoProps} />
              {errorOverlay}
            </>
          )
        ) : (
          <>
            <Video {...videoProps} />
            {errorOverlay}
            {controlsBar}
          </>
        )}
      </View>
    </PlayerErrorBoundary>
  );
}
