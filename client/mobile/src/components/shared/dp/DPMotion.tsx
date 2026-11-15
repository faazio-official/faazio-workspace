import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

const ENTER_MS = 240;
const STAGGER_MS = 30;
const MAX_STAGGERED = 8;

/** Honour the OS "Reduce Motion" setting; motion is optional, never required to read. */
function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduced(value);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

interface DPFadeInProps {
  children: React.ReactNode;
  /** Row position; the first eight rows stagger by 30 ms, the rest start together. */
  index?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Entrance for list rows and cards: fade + 12 dp rise on the entrance curve
 * (ease-out), staggered 30 ms and capped so nothing waits. Collapses to the
 * final state when Reduce Motion is on.
 */
export function DPFadeIn({ children, index = 0, style }: DPFadeInProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: ENTER_MS,
      delay: Math.min(index, MAX_STAGGERED - 1) * STAGGER_MS,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [index, progress, reduceMotion]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });

  return (
    <Animated.View style={[style, { opacity: progress, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}