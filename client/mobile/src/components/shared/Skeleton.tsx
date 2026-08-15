import React, { memo, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { hs, ms, vs } from '@/utils/responsive';

interface SkeletonBlockProps {
  width?: number | `${number}%`;
  height: number;
  radius?: number;
  style?: object;
}

/**
 * Shared shimmering skeleton block. A single animated opacity pulse loop used
 * to build loading placeholders for any screen (food, mart, grocery, pharma).
 * Override the base color via the `style` prop if a theme differs.
 */
const SkeletonBlock = memo(function SkeletonBlock({
  width = '100%',
  height,
  radius = ms(12),
  style,
}: SkeletonBlockProps) {
  const pulse = useSharedValue(0.35);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(0.85, { duration: 850, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [pulse]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return <Animated.View style={[styles.block, { width, height, borderRadius: radius }, animatedStyle, style]} />;
});

const styles = StyleSheet.create({
  block: {
    backgroundColor: '#E5E7EB',
  },
});

export default SkeletonBlock;
export { SkeletonBlock };
