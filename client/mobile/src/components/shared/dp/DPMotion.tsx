import React, { useEffect, useRef, useState } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';
import { DURATION, EASE_ENTRANCE, STAGGER } from '@/theme/motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/** Rows past this start together so a long list never waits on its tail. */
const MAX_STAGGERED = 8;
/** Shared rise distance (dp) for both the entrance and its mirrored exit. */
const RISE = 12;

interface DPFadeInProps {
  children: React.ReactNode;
  /** Row position; the first eight rows stagger by `STAGGER`, the rest start together. */
  index?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Entrance for list rows and cards: fade + 12 dp rise on the shared entrance
 * curve (`DURATION.enter` / `EASE_ENTRANCE` / `STAGGER`), staggered and capped so
 * nothing waits. Collapses to the final state when Reduce Motion is on.
 */
export function DPFadeIn({ children, index = 0, style }: DPFadeInProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: DURATION.enter,
      delay: Math.min(index, MAX_STAGGERED - 1) * STAGGER,
      easing: EASE_ENTRANCE,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [index, progress, reduceMotion]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [RISE, 0] });

  return (
    <Animated.View style={[style, { opacity: progress, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

interface DPFadeOutProps {
  children: React.ReactNode;
  /** When false, plays the exit (fade + 12 dp fall) then unmounts. */
  visible: boolean;
  /** Fired once the exit finishes, or immediately under Reduce Motion. */
  onExited?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Exit primitive for a row that leaves a list. Exits are always 20% shorter than
 * entrances (`DURATION.exit` = 80% of `DURATION.enter`), on the same entrance
 * curve. Reduce Motion unmounts instantly (no fade). The caller keeps the item
 * in its data until `onExited` fires, so the removal is explained rather than
 * a pop.
 */
export function DPFadeOut({ children, visible, onExited, style }: DPFadeOutProps) {
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(true);
  const onExitedRef = useRef(onExited);

  useEffect(() => {
    onExitedRef.current = onExited;
  }, [onExited]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.setValue(1);
      return;
    }
    if (reduceMotion) {
      setMounted(false);
      onExitedRef.current?.();
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 0,
      duration: DURATION.exit,
      easing: EASE_ENTRANCE,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (!finished) return;
      setMounted(false);
      onExitedRef.current?.();
    });
    return () => animation.stop();
  }, [visible, reduceMotion, progress]);

  if (!mounted) return null;

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [RISE, 0] });

  return (
    <Animated.View style={[style, { opacity: progress, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}
