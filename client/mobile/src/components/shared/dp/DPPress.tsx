import { useCallback, useMemo, useRef } from 'react';
import { Animated } from 'react-native';
import { DURATION, EASE_ENTRANCE, SCALE } from '@/theme/motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/**
 * Timed press-scale feedback for the delivery primitives (no reanimated in this
 * layer — core `Animated` only). Press-in scales to `SCALE.press` (0.97) over
 * `DURATION.press` (120 ms); press-out reverses over `DURATION.menu` (180 ms),
 * both on `EASE_ENTRANCE`. Reduce Motion makes it a no-op, so press still works.
 *
 * Attach `onPressIn`/`onPressOut` to the pressable and `animatedStyle` to its
 * style; the transform is driven natively.
 */
export function usePressScale() {
  const scale = useRef(new Animated.Value(1)).current;
  const reduceMotion = useReducedMotion();

  const animate = useCallback(
    (toValue: number, duration: number) => {
      if (reduceMotion) return;
      Animated.timing(scale, {
        toValue,
        duration,
        easing: EASE_ENTRANCE,
        useNativeDriver: true,
      }).start();
    },
    [reduceMotion, scale],
  );

  const onPressIn = useCallback(() => animate(SCALE.press, DURATION.press), [animate]);
  const onPressOut = useCallback(() => animate(1, DURATION.menu), [animate]);

  const animatedStyle = useMemo(() => ({ transform: [{ scale }] }), [scale]);

  return { onPressIn, onPressOut, animatedStyle };
}
