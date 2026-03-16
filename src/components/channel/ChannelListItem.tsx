import React, { memo, useEffect, useRef } from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import type { Channel } from '../../lib/types';

const ROW_HEIGHT = 60;

type Props = {
  channel: Channel;
  /** Outer row focus */
  isFocused: boolean;
  /** Optional secondary action (heart, etc.) focus */
  isSecondaryFocused?: boolean;
  /** Show subtle highlight when this channel is currently playing */
  isNowPlaying?: boolean;
  /** Called when the row is pressed */
  onPress: (channel: Channel) => void;
  /** Optional secondary action (e.g. toggle favorite). If omitted, no secondary button is rendered. */
  onSecondaryPress?: (channelId: string) => void;
  /** Node handle that should receive D-pad Right focus (Android TV). */
  nextFocusRight?: number | null;
  /** When false, disables TV focus for row + secondary button. */
  focusable?: boolean;
  /** Called when either row or secondary gains focus; caller can distinguish via focusKey. */
  onFocusKey?: (key: string) => void;
  onBlurKey?: () => void;
  /** Optional override icon + color for secondary button. */
  secondaryIconName?: string;
  secondaryIconColor?: string;
};

export const ChannelListItem = memo(function ChannelListItem({
  channel,
  isFocused,
  isSecondaryFocused = false,
  isNowPlaying = false,
  onPress,
  onSecondaryPress,
  nextFocusRight,
  focusable = true,
  onFocusKey,
  onBlurKey,
  secondaryIconName,
  secondaryIconColor,
}: Props) {
  const rowRef = useRef<React.ComponentRef<typeof Pressable>>(null);
  const secondaryRef = useRef<React.ComponentRef<typeof Pressable>>(null);

  // Ensure nextFocusRight is applied reliably on Android TV, even with list recycling.
  useEffect(() => {
    if (nextFocusRight == null) return;
    const refs = [rowRef.current, secondaryRef.current];
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

  const focusKeyRow = `channel-${channel.id}`;
  const focusKeySecondary = `channel-secondary-${channel.id}`;

  const showSecondary = !!onSecondaryPress;
  const iconName = secondaryIconName ?? 'heart';
  const iconColor = secondaryIconColor ?? '#ec4899';

  return (
    <Pressable
      ref={rowRef}
      onPress={() => onPress(channel)}
      onLongPress={onSecondaryPress ? () => onSecondaryPress(channel.id) : undefined}
      onFocus={() => onFocusKey?.(focusKeyRow)}
      onBlur={onBlurKey}
      {...(nextFocusRight != null ? ({ nextFocusRight } as { nextFocusRight: number }) : {})}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        height: ROW_HEIGHT,
        paddingHorizontal: 16,
        gap: 12,
        backgroundColor: isNowPlaying ? 'rgba(139, 92, 246, 0.12)' : 'transparent',
        borderWidth: isFocused ? 3 : 1,
        borderColor: isFocused ? '#d8b4fe' : 'transparent',
        borderRadius: 12,
      }}
      focusable={focusable}
    >
      {channel.logo ? (
        <Image
          source={{ uri: channel.logo }}
          style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: '#272732' }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            backgroundColor: '#272732',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MaterialCommunityIcons name="television" size={22} color="#6e6e7d" />
        </View>
      )}

      <View style={{ flex: 1 }}>
        <Text className="text-white text-base font-medium" numberOfLines={1}>
          {channel.name}
        </Text>
        {isNowPlaying && (
          <Text style={{ color: '#a78bfa', fontSize: 12, marginTop: 2 }}>Jetzt läuft</Text>
        )}
      </View>

      {showSecondary && (
        <Pressable
          ref={secondaryRef}
          onPress={() => onSecondaryPress?.(channel.id)}
          onFocus={() => onFocusKey?.(focusKeySecondary)}
          onBlur={onBlurKey}
          {...(nextFocusRight != null ? ({ nextFocusRight } as { nextFocusRight: number }) : {})}
          style={{
            width: 40,
            height: 40,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: isSecondaryFocused ? 2 : 0,
            borderColor: '#d8b4fe',
            borderRadius: 8,
          }}
          focusable={focusable}
          hitSlop={8}
        >
          <MaterialCommunityIcons name={iconName} size={22} color={iconColor} />
        </Pressable>
      )}
    </Pressable>
  );
});

