import React from 'react';
import { Pressable } from 'react-native';
import type { GestureResponderEvent, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { DURATION, EASE_ENTRANCE, SCALE } from '@/theme/motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Scale applied while pressed. Defaults to 0.97 (docs/UI_DESIGN_SYSTEM.md §3). */
  pressScale?: number;
  children?: React.ReactNode;
}

/**
 * Shared press feedback: a timed scale to 0.97 (never a spring, never a tween
 * with overshoot). Reduce Motion removes the scale but keeps the press working.
 */
export function PressableScale({
  style,
  pressScale = SCALE.press,
  onPressIn,
  onPressOut,
  disabled,
  children,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = (event: GestureResponderEvent) => {
    if (!reduceMotion) {
      scale.value = withTiming(pressScale, {
        duration: DURATION.press,
        easing: EASE_ENTRANCE,
      });
    }
    onPressIn?.(event);
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    if (!reduceMotion) {
      scale.value = withTiming(1, {
        duration: DURATION.press,
        easing: EASE_ENTRANCE,
      });
    }
    onPressOut?.(event);
  };

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}

export default PressableScale;
