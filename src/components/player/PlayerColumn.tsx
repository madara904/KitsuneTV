import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, Pressable, findNodeHandle, type ViewStyle } from 'react-native';
import Video from 'react-native-video';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { usePlayer } from '../../context/PlayerContext';
import { recentRepo } from '../../db/repositories/recentRepo';

/** Catches crashes from Video/ExoPlayer so the app doesn't die – show error UI instead. */
class PlayerErrorBoundary extends React.Component<
  { children: React.ReactNode; onReset: () => void },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: '' };

  static getDerivedStateFromError(err: unknown) {
    return { hasError: true, message: err instanceof Error ? err.message : String(err) };
  }

  componentDidCatch() {
    // already in state
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ color: '#ef4444', textAlign: 'center', marginBottom: 16 }}>
            Player abgestürzt. {this.state.message}
          </Text>
          <Pressable onPress={() => { this.setState({ hasError: false, message: '' }); this.props.onReset(); }} style={{ paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#8b5cf6', borderRadius: 8 }}>
            <Text style={{ color: '#fff' }}>Schließen & neu wählen</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

type PlayerControlFocus = 'play' | 'fullscreen' | 'close' | 'error-close' | null;

export function PlayerColumn() {
  const { currentChannel, setCurrentChannel, fullscreen, setFullscreen, setPlayerFocusNodeHandle } = usePlayer();
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [focusedControl, setFocusedControl] = useState<PlayerControlFocus>(null);
  const firstFocusableRef = useRef<View>(null);
  const placeholderFocusRef = useRef<View>(null);

  const handlePlayerError = useCallback((e: unknown) => {
    try {
      const msg =
        (e != null && typeof e === 'object' && 'error' in e && e.error != null && typeof (e as { error: { errorString?: string } }).error === 'object')
          ? String((e as { error: { errorString?: string } }).error.errorString ?? (e as { error: unknown }).error)
          : 'Playback error';
      setError(msg);
      setPaused(true);
    } catch {
      setError('Playback error');
      setPaused(true);
    }
  }, []);

  // Defer DB write so it doesn't block the same frame as video start (smoother playback)
  useEffect(() => {
    if (!currentChannel?.id) return;
    const t = setTimeout(() => {
      recentRepo.add(currentChannel.id);
    }, 500);
    return () => clearTimeout(t);
  }, [currentChannel?.id]);

  // Register first focusable so LiveScreen can set nextFocusRight on channel rows (D-pad Right → player).
  // useLayoutEffect so the handle is set before paint and channel rows get it on first render.
  React.useLayoutEffect(() => {
    const el = currentChannel ? firstFocusableRef.current : placeholderFocusRef.current;
    const handle = findNodeHandle(el);
    setPlayerFocusNodeHandle(handle);
    return () => setPlayerFocusNodeHandle(null);
  }, [currentChannel, setPlayerFocusNodeHandle]);

  const PLAYER_WIDTH = 380;

  if (!currentChannel) {
    return (
      <View
        className="items-center justify-center"
        style={{ width: PLAYER_WIDTH, backgroundColor: '#0e0e12', borderLeftWidth: 1, borderLeftColor: '#282832', alignSelf: 'stretch' } as ViewStyle}
      >
        <Pressable ref={placeholderFocusRef} focusable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <MaterialCommunityIcons name="television-play" size={48} color="#3f3f46" />
        <Text className="text-zinc-500 mt-2 text-center px-4">Kanal wählen</Text>
      </View>
    );
  }

  const containerStyle: ViewStyle = fullscreen
    ? { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, backgroundColor: '#000' }
    : { width: PLAYER_WIDTH, backgroundColor: '#000', borderLeftWidth: 1, borderLeftColor: '#282832', alignSelf: 'stretch' };

  // Larger buffer = less stutter on weak networks / emulator (ExoPlayer on Android)
  const bufferConfig = {
    minBufferMs: 8000,
    maxBufferMs: 25000,
    bufferForPlaybackMs: 2500,
    bufferForPlaybackAfterRebufferMs: 5000,
  };

  const content = (
    <View style={containerStyle}>
      <Video
        source={{ uri: currentChannel.streamUrl }}
        style={{ flex: 1, width: '100%' }}
        resizeMode="contain"
        paused={paused || !!error}
        rate={1.0}
        bufferConfig={bufferConfig}
        progressUpdateInterval={1000}
        useTextureView={true}
        onError={handlePlayerError}
        onLoad={() => setError(null)}
        focusable={false}
      />
      {error && (
        <View className="absolute inset-0 items-center justify-center bg-black/80">
          <Text className="text-red-400 mb-4 text-center px-4">{error}</Text>
          <Pressable
            onPress={() => setCurrentChannel(null)}
            onFocus={() => setFocusedControl('error-close')}
            onBlur={() => setFocusedControl((c) => (c === 'error-close' ? null : c))}
            style={{
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 8,
              backgroundColor: '#8b5cf6',
              borderWidth: focusedControl === 'error-close' ? 3 : 0,
              borderColor: '#d8b4fe',
            }}
            focusable
          >
            <Text className="text-white">Schließen</Text>
          </Pressable>
        </View>
      )}
      <View className="absolute bottom-0 left-0 right-0 flex-row items-center justify-between p-3 bg-black/70">
        <Text className="text-white text-sm flex-1" numberOfLines={1}>
          {currentChannel.name}
        </Text>
        <View className="flex-row gap-2">
          <Pressable
            ref={firstFocusableRef}
            onPress={() => setPaused((p) => !p)}
            onFocus={() => setFocusedControl('play')}
            onBlur={() => setFocusedControl((c) => (c === 'play' ? null : c))}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(255,255,255,0.2)',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: focusedControl === 'play' ? 3 : 0,
              borderColor: '#d8b4fe',
            }}
            focusable
          >
            <MaterialCommunityIcons name={paused ? 'play' : 'pause'} size={24} color="#fff" />
          </Pressable>
          <Pressable
            onPress={() => setFullscreen(!fullscreen)}
            onFocus={() => setFocusedControl('fullscreen')}
            onBlur={() => setFocusedControl((c) => (c === 'fullscreen' ? null : c))}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(255,255,255,0.2)',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: focusedControl === 'fullscreen' ? 3 : 0,
              borderColor: '#d8b4fe',
            }}
            focusable
          >
            <MaterialCommunityIcons name={fullscreen ? 'fullscreen-exit' : 'fullscreen'} size={22} color="#fff" />
          </Pressable>
          <Pressable
            onPress={() => setCurrentChannel(null)}
            onFocus={() => setFocusedControl('close')}
            onBlur={() => setFocusedControl((c) => (c === 'close' ? null : c))}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(255,255,255,0.2)',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: focusedControl === 'close' ? 3 : 0,
              borderColor: '#d8b4fe',
            }}
            focusable
          >
            <MaterialCommunityIcons name="close" size={22} color="#fff" />
          </Pressable>
        </View>
      </View>
    </View>
  );

  return (
    <PlayerErrorBoundary onReset={() => setCurrentChannel(null)}>
      {content}
    </PlayerErrorBoundary>
  );
}
