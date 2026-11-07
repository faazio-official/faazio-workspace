import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Tracks the OS "Reduce Motion" setting. Use it to disable looping or
 * decorative animation; keep short, explanatory transitions.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduced(value);
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      if (mounted) setReduced(value);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}