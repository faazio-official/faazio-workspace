import { useRef, useEffect } from 'react';
import { Animated } from 'react-native';

export function usePulse(duration = 1200, minValue = 0.3) {
  const anim = useRef(new Animated.Value(1));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim.current, {
          toValue: minValue,
          duration: duration / 2,
          useNativeDriver: true,
        }),
        Animated.timing(anim.current, {
          toValue: 1,
          duration: duration / 2,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [duration, minValue]);

  return anim.current;
}

export function useSpringBounce(active = false) {
  const anim = useRef(new Animated.Value(active ? 1.3 : 1));

  useEffect(() => {
    Animated.spring(anim.current, {
      toValue: active ? 1.3 : 1,
      friction: 3,
      tension: 200,
      useNativeDriver: true,
    }).start();
  }, [active]);

  return anim.current;
}
