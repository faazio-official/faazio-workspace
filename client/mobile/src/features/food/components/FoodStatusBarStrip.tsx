import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { foodTheme } from '../constants/theme';

interface FoodStatusBarStripProps {
  scrollY: SharedValue<number>;
  threshold?: number;
}

/**
 * Opaque light-orange strip rendered over the top status-bar inset. Android
 * edge-to-edge mode exposes no native status-bar background API, so we
 * paint our own bar: transparent at the top, fading to an opaque primaryLight
 * once the screen is scrolled. Icons remain dark (set globally in App.tsx).
 */
const FoodStatusBarStrip = React.memo(function FoodStatusBarStrip({
  scrollY,
  threshold = 8,
}: FoodStatusBarStripProps) {
  const insets = useSafeAreaInsets();

  const opacity = useDerivedValue(() =>
    withTiming(scrollY.value > threshold ? 1 : 0, { duration: 180 }),
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.strip, { height: insets.top }, animatedStyle]}
    />
  );
});

export default FoodStatusBarStrip;

const styles = StyleSheet.create({
  strip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: foodTheme.primaryLight,
    zIndex: 100,
  },
});
