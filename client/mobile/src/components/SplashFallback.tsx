import React from 'react';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  Platform,
  Text,
} from 'react-native';
import { FaazioLogo } from '@/components/FaazioLogo';
import { SplashWordmarkReveal } from '@/components/SplashWordmarkReveal';
import { parentRamp } from '@/theme/brandTokens';
import { useThemeMode } from '@/hooks/useThemeMode';

/**
 * Layer-2 must render the wordmark at the same size as the native layer-1
 * splash, or the handoff visibly jumps.
 *
 * Layer 1 draws a square canvas — Android 288dp and iOS 288pt (the storyboard's
 * explicit width, matched to Android) — with the wordmark fitted inside the
 * Android 12+ 192dp mask circle at 92% fill, per
 * `scripts/generate-splash-logo.py`. That is 170.1dp of visible ink. Reproducing
 * that ink width on the wide 2171×724 asset makes the two layers optically
 * identical: both now measure ~510px of ink on a 1080px screen, where the
 * previous arbitrary 220dp canvas drew ~625px (1.23× too big) and, when the
 * Image fell back to its intrinsic 2171px width, center-cropped the wordmark
 * down to just "az".
 */
const MASK_RADIUS_DP = 96;
const MASK_FILL = 0.92;
const CANVAS_W = 2171;
const CANVAS_H = 724;
const INK_W = 2055;
const INK_H = 573;
/** Native layer-1 canvas width in dp/pt for the running platform. */
const NATIVE_CANVAS = 288;

const inkAspect = INK_W / INK_H;
const inkOnNativeCanvas =
  (2 * MASK_RADIUS_DP) / Math.sqrt(1 + 1 / inkAspect ** 2) * MASK_FILL;
/** Canvas width whose visible ink width matches layer 1. */
const ROYAL_LOGO_W = ((NATIVE_CANVAS * inkOnNativeCanvas) / 288) * (CANVAS_W / INK_W);
const ROYAL_LOGO_H = ROYAL_LOGO_W * (CANVAS_H / CANVAS_W);

/**
 * Bottom credit line. This is the single owner of the "Product of FA CREATORS"
 * credit on Android — the native splash draws only the wordmark, because a baked
 * bitmap cannot be shown without the platform stretching it into a
 * WindowManager-Shell-sized box (which distorted the text). The metrics mirror
 * the iOS storyboard label (one medium run, 0.3 tracking, 90% white) so the
 * credit looks the same on every platform.
 *
 * The credit is deliberately a *quiet caption*: at 10dp Roboto/System Medium it
 * measures ~121dp, i.e. ~0.71× the ~170dp wordmark ink. At the earlier 12dp it
 * measured ~144dp (0.85× the ink) and a wide baked-font native layer ran ~198dp
 * — wider than the wordmark itself, which read as a size mismatch. Keep this
 * value in lockstep with `pointSize` in `ios/Faazio/SplashScreen.storyboard`.
 */
const CREDIT_TEXT = 'Product of FA CREATORS';
const CREDIT_FONT_SIZE = 10;
const CREDIT_TRACKING = 0.3;
const CREDIT_OPACITY = 230 / 255;
/**
 * Matches the iOS storyboard's 56pt inset and, on Android API 31+, the platform's
 * 60dp branding margin where a native credit would otherwise have sat.
 */
const CREDIT_BOTTOM_INSET =
  Platform.OS === 'android' &&
  typeof Platform.Version === 'number' &&
  Platform.Version >= 31
    ? 60
    : 56;

interface SplashFallbackProps {
  /**
   * 'royal' renders the cold-start splash with a Faazio blue (#1627E9)
   * background and the centered wide wordmark image (no spinner).
   * The wordmark asset is generated with the blue field keyed to
   * transparency (`scripts/generate-splash-logo.py`), so it is
   * background-independent and cannot be cropped by a colour mismatch.
   * Default ('default') keeps the lightweight white/blue splash used by
   * navigation Suspense fallbacks.
   */
  variant?: 'default' | 'royal';
}

/**
 * Suspense fallback shown while a lazily-imported screen's JS chunk loads.
 * Lightweight on purpose — avoid importing heavy components here.
 */
export function SplashFallback({ variant = 'default' }: SplashFallbackProps) {
  const { palette } = useThemeMode();
  if (variant === 'royal') {
    return (
      <View style={[styles.container, styles.royalContainer]}>
        <View style={styles.royalLogoBox}>
          <SplashWordmarkReveal width={ROYAL_LOGO_W} height={ROYAL_LOGO_H} />
        </View>
        <Text style={styles.royalCredit}>{CREDIT_TEXT}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <FaazioLogo size={40} />
      <ActivityIndicator size="small" color={parentRamp.base} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  royalContainer: {
    backgroundColor: parentRamp.base,
  },
  /**
   * Explicit numeric box so the reveal's SVG viewBox (0 0 2171 724) maps 1:1
   * onto the wordmark ink; the old Image relied on this to avoid falling back
   * to the asset's intrinsic 2171px width and center-cropping to "az".
   */
  royalLogoBox: {
    width: ROYAL_LOGO_W,
    height: ROYAL_LOGO_H,
  },
  /**
   * One line of type anchored at the platform's credit inset. The metrics match
   * the iOS storyboard label (single medium run, 10dp, 0.3 tracking, 90% white),
   * so the credit looks identical on Android and iOS.
   */
  royalCredit: {
    position: 'absolute',
    bottom: CREDIT_BOTTOM_INSET,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: CREDIT_FONT_SIZE,
    fontWeight: '500',
    letterSpacing: CREDIT_TRACKING,
    color: parentRamp.onBase,
    opacity: CREDIT_OPACITY,
  },
  spinner: {
    marginTop: 16,
  },
});
