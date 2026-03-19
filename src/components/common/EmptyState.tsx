import React from 'react';
import { View, Text, Pressable, findNodeHandle } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

type Props = {
  iconName: string;
  title: string;
  description?: string;
  /** Optional primary action (e.g. "Open Settings"). */
  actionLabel?: string;
  onActionPress?: () => void;
  /** Optional focus wiring for TV: focusKey is compared against focusedKey for styling. */
  focusKey?: string;
  focusedKey?: string | null;
  onFocusKey?: (key: string) => void;
  onBlurKey?: () => void;
  nextFocusUp?: number | null;
  nextFocusDown?: number | null;
  /** Optional callback to expose the action button node handle for explicit nextFocus wiring. */
  onActionNodeHandle?: (handle: number | null) => void;
};

export function EmptyState({
  iconName,
  title,
  description,
  actionLabel,
  onActionPress,
  focusKey,
  focusedKey,
  onFocusKey,
  onBlurKey,
  nextFocusUp,
  nextFocusDown,
  onActionNodeHandle,
}: Props) {
  const hasAction = !!actionLabel && !!onActionPress;

  return (
    <View
      className="flex-1 p-6 justify-center items-center"
      style={{ backgroundColor: '#0e0e12' }}
    >
      <MaterialCommunityIcons name={iconName} size={64} color="#6e6e7d" />
      <Text className="text-white text-lg mt-4">{title}</Text>
      {description ? (
        <Text className="text-zinc-400 text-center mt-1">{description}</Text>
      ) : null}
      {hasAction && (
        <Pressable
          ref={(node) => {
            if (!onActionNodeHandle) return;
            const handle = node ? findNodeHandle(node) : null;
            onActionNodeHandle(handle);
          }}
          onPress={onActionPress}
          onFocus={focusKey && onFocusKey ? () => onFocusKey(focusKey) : undefined}
          onBlur={onBlurKey}
          focusable
          className="mt-6 px-6 py-3 rounded-xl bg-primary-500"
          style={{
            borderWidth: focusKey && focusedKey === focusKey ? 3 : 0,
            borderColor: '#d8b4fe',
          }}
          {...(nextFocusUp != null || nextFocusDown != null
            ? ({
                nextFocusUp: nextFocusUp ?? undefined,
                nextFocusDown: nextFocusDown ?? undefined,
              } as Record<string, number | undefined>)
            : {})}
        >
          <Text className="text-white font-medium">{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

