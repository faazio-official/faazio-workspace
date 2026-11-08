import React, { useEffect, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { DURATION, EASE_ENTRANCE, EASE_MOVE, SCALE } from '@/theme/motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface SuccessPulseProps {
  children: ReactNode;
  /** Change this to replay the pulse (e.g. an order id or a counter). */
  trigger?: string | number;
  style?: StyleProp<ViewStyle>;
}

/**
 * A single, short scale pulse that confirms success (docs/UI_DESIGN_SYSTEM.md
 * §3 Pass 9). One pulse, never a loop. Reduce Motion shows the final state.
 */
export function SuccessPulse({ children, trigger, style }: SuccessPulseProps) {
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      scale.value = 1;
      return;
    }
    scale.value = 1;
    scale.value = withSequence(
      withTiming(SCALE.knob, { duration: 180, easing: EASE_MOVE }),
      withTiming(1, { duration: DURATION.move, easing: EASE_ENTRANCE }),
    );
  }, [trigger, reduceMotion, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

export default SuccessPulse;
