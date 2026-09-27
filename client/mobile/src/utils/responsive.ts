import { Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('screen');

const BASELINE_W = 375;
const BASELINE_H = 812;

export { SCREEN_W, SCREEN_H };

export function useTopInset(): number {
  return useSafeAreaInsets().top;
}

/** Bottom safe-area value reserved **once** by the app root (`App.tsx`'s
 *  `AppLayout`), for the Android gesture pill / 3-button bar (the window is
 *  edge-to-edge: `android:navigationBarColor` is transparent) and the iOS home
 *  indicator. Screens and bottom navbars sit inside the reserved area, so they
 *  use their base heights and must not also add `insets.bottom`. Modals render
 *  in separate native windows and keep their own insets. `Math.max(…, vs(8))`
 *  keeps a minimum strip on devices with no reported inset. */
export function useBottomInset(): number {
  return Math.max(useSafeAreaInsets().bottom, vs(8));
}

export function hs(n: number): number {
  return (n * SCREEN_W) / BASELINE_W;
}

export function vs(n: number): number {
  return (n * SCREEN_H) / BASELINE_H;
}

export function ms(n: number, factor = 0.5): number {
  return n + (hs(n) - n) * factor;
}

export function wp(pct: number): number {
  return (SCREEN_W * pct) / 100;
}

export function hp(pct: number): number {
  return (SCREEN_H * pct) / 100;
}

export const DOME_RADIUS = ms(44);
