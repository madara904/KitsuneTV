import React, { memo } from 'react';
import { Pressable, type ViewStyle } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

type TvIconButtonProps = {
  icon: string;
  size?: number;
  color?: string;
  /** When true, apply the strong TV focus ring. */
  focused?: boolean;
  /** Optional semantic variant to tweak background colour. */
  variant?: 'solid' | 'ghost';
  disabled?: boolean;
  onPress?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  /**
   * Optional next-focus overrides for TV. These are passed through to Pressable.
   * Use node handles from findNodeHandle.
   */
  nextFocusLeft?: number | null;
  nextFocusRight?: number | null;
  nextFocusUp?: number | null;
  nextFocusDown?: number | null;
  hasTVPreferredFocus?: boolean;
};

export const TvIconButton = memo(function TvIconButton({
  icon,
  size = 22,
  color = '#fff',
  focused = false,
  variant = 'solid',
  disabled,
  onPress,
  onFocus,
  onBlur,
  nextFocusLeft,
  nextFocusRight,
  nextFocusUp,
  nextFocusDown,
  hasTVPreferredFocus,
}: TvIconButtonProps) {
  const style: ViewStyle = {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor:
      variant === 'solid'
        ? 'rgba(255,255,255,0.2)'
        : 'rgba(0,0,0,0.4)',
    borderWidth: focused ? 3 : 0,
    borderColor: '#d8b4fe',
    opacity: disabled ? 0.6 : 1,
  };

  const focusProps: Record<string, number> = {};
  if (nextFocusLeft != null) focusProps.nextFocusLeft = nextFocusLeft;
  if (nextFocusRight != null) focusProps.nextFocusRight = nextFocusRight;
  if (nextFocusUp != null) focusProps.nextFocusUp = nextFocusUp;
  if (nextFocusDown != null) focusProps.nextFocusDown = nextFocusDown;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onFocus={onFocus}
      onBlur={onBlur}
      disabled={disabled}
      hasTVPreferredFocus={hasTVPreferredFocus}
      style={style}
      {...(focusProps as Record<string, number>)}
    >
      <MaterialCommunityIcons name={icon} size={size} color={color} />
    </Pressable>
  );
});

