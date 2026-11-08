import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { DURATION, EASE_ENTRANCE } from '@/theme/motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface AnimatedIconSwapProps {
  /** Changes when the icon changes (e.g. `isFavorite ? 'on' : 'off'`). */
  iconKey: string | number;
  children: ReactNode;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Cross-fades an icon swap with a small scale and blur on the entrance curve
 * (docs/UI_DESIGN_SYSTEM.md §3 Pass 9). Reduce Motion swaps instantly.
 */
export function AnimatedIconSwap({ iconKey, children, size = 24, style }: AnimatedIconSwapProps) {
  const [previous, setPrevious] = useState<ReactNode>(null);
  const keyRef = useRef(iconKey);
  const currentRef = useRef<ReactNode>(children);
  const progress = useSharedValue(1);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (keyRef.current === iconKey) {
      currentRef.current = children;
      return;
    }
    keyRef.current = iconKey;

    if (reduceMotion) {
      currentRef.current = children;
      setPrevious(null);
      progress.value = 1;
      return;
    }

    setPrevious(currentRef.current);
    currentRef.current = children;
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: DURATION.menu,
      easing: EASE_ENTRANCE,
    });
  }, [iconKey, children, reduceMotion, progress]);

  const incomingStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.85 + 0.15 * progress.value }],
    filter: [{ blur: (1 - progress.value) * 3 }],
  }));

  const outgoingStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ scale: 1 - 0.15 * progress.value }],
    filter: [{ blur: progress.value * 3 }],
  }));

  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      {previous ? (
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, outgoingStyle]}>
          {previous}
        </Animated.View>
      ) : null}
      <Animated.View style={[styles.center, incomingStyle]}>{children}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AnimatedIconSwap;
