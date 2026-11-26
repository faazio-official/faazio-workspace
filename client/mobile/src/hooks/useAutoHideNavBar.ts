import { useCallback, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { makeMutable, useAnimatedStyle, withTiming } from 'react-native-reanimated';

/**
 * Shared 0 → 1 progress that slides a bottom navigation off-screen while the list scrolls down
 * and back in while it scrolls up (0 = shown, 1 = hidden). It is module-level and shared by every
 * bottom nav because only one is visible at a time (MainTabs' `HubTabBar`, a `SubAppWrapper` nav,
 * or the Food nav); each nav surfaces it again whenever it mounts/focuses or the tab changes.
 */
export const navBarHide = makeMutable(0);

/** Signed distance scrolled since the last toggle; crossing the threshold flips the bar. */
const navBarAccum = makeMutable(0);

const HIDE_DURATION = 200;
/** Within this many px of the top the bar is always shown. */
const SHOW_AT_TOP = 4;
/** Accumulated scroll before toggling, so slow drags still hide and jitter never flickers. */
const TOGGLE_DISTANCE = 18;

/**
 * Worklet: toggle the bar from the absolute offset `y` and this frame's delta `dy`. Scroll movement
 * accumulates in one direction; enough downward travel hides, enough upward travel shows, and
 * reaching the top always shows. Shared by the UI-thread (`HomeView`) and JS-thread handlers so
 * both behave identically.
 */
export function driveNavBarFromDelta(dy: number, y: number) {
  'worklet';
  if (y <= SHOW_AT_TOP) {
    navBarAccum.value = 0;
    if (navBarHide.value !== 0) navBarHide.value = withTiming(0, { duration: 160 });
    return;
  }
  const acc = navBarAccum.value + dy;
  if (acc > TOGGLE_DISTANCE) {
    navBarAccum.value = 0;
    if (navBarHide.value !== 1) navBarHide.value = withTiming(1, { duration: HIDE_DURATION });
  } else if (acc < -TOGGLE_DISTANCE) {
    navBarAccum.value = 0;
    if (navBarHide.value !== 0) navBarHide.value = withTiming(0, { duration: HIDE_DURATION });
  } else {
    navBarAccum.value = acc;
  }
}

/** Show a nav immediately (mount / focus / tab switch) so a new surface never starts hidden. */
export function revealNavBar() {
  'worklet';
  navBarAccum.value = 0;
  navBarHide.value = withTiming(0, { duration: 160 });
}

/**
 * JS-thread `onScroll` handler for a plain ScrollView/FlatList. It only writes the shared target
 * progress once per frame; the actual slide runs on the UI thread (see `useNavBarHideStyle`).
 */
export function useNavBarScrollHandler() {
  const lastY = useRef<number | null>(null);
  return useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const prev = lastY.current;
    lastY.current = y;
    // Skip the first event: a restored/initial offset is not a user scroll gesture.
    if (prev === null) return;
    driveNavBarFromDelta(y - prev, y);
  }, []);
}

/** Animated style that slides a nav dock down by `hideDistance` as the hide progress reaches 1. */
export function useNavBarHideStyle(hideDistance: number) {
  return useAnimatedStyle(() => ({
    transform: [{ translateY: navBarHide.value * hideDistance }],
  }));
}

/**
 * Animated bottom clearance that tracks the nav's hide progress: full `reserve` while the bar is
 * shown, `0` once it has slid away. Use this instead of a static `paddingBottom` so a hidden
 * floating nav leaves no empty background band behind it.
 */
export function useNavBarReserveStyle(reserve: number) {
  return useAnimatedStyle(
    () => ({
      paddingBottom: (1 - navBarHide.value) * reserve,
    }),
    [reserve],
  );
}
