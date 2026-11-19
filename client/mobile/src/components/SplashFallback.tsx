import React from 'react';
import { StyleSheet, View, ActivityIndicator, Image, Platform, Text } from 'react-native';
import { FaazioLogo } from '@/components/FaazioLogo';
import logoWordmarkImg from '@/assets/logo-wordmark-transparent.png';
import { parentRamp } from '@/theme/brandTokens';
import { useThemeMode } from '@/hooks/useThemeMode';

/**
 * Layer-2 must render the wordmark at the same size as the native layer-1
 * splash, or the handoff visibly jumps.
 *
 * Layer 1 draws a square canvas — Android 288dp, iOS 200pt (the storyboard's
 * explicit width) — with the wordmark fitted inside the Android 12+ 192dp mask
 * circle at 92% fill, per `scripts/generate-splash-logo.py`. That is 170.1dp of
 * visible ink. Reproducing that ink width on the wide 2171×724 asset makes the
 * two layers optically identical: both now measure ~507px of ink on a 1080px
 * screen, where the previous arbitrary 220dp canvas drew ~625px (1.23× too big)
 * and, when the Image fell back to its intrinsic 2171px width, center-cropped
 * the wordmark down to just "az".
 */
const MASK_RADIUS_DP = 96;
const MASK_FILL = 0.92;
const CANVAS_W = 2171;
const CANVAS_H = 724;
const INK_W = 2055;
const INK_H = 573;
/** Native layer-1 canvas width in dp/pt for the running platform. */
const NATIVE_CANVAS = Platform.select({ ios: 200, default: 288 });

const inkAspect = INK_W / INK_H;
const inkOnNativeCanvas =
  (2 * MASK_RADIUS_DP) / Math.sqrt(1 + 1 / inkAspect ** 2) * MASK_FILL;
/** Canvas width whose visible ink width matches layer 1. */
const ROYAL_LOGO_W = ((NATIVE_CANVAS * inkOnNativeCanvas) / 288) * (CANVAS_W / INK_W);
const ROYAL_LOGO_H = ROYAL_LOGO_W * (CANVAS_H / CANVAS_W);

/** Bottom credit line, identical to the native splash credit. */
const SPLASH_CREDIT = 'Product of FA CREATORS';
const CREDIT_BOTTOM_INSET = 56;

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
          <Image
            source={logoWordmarkImg}
            style={styles.royalLogo}
            resizeMode="contain"
            fadeDuration={0}
          />
        </View>
        <Text style={styles.royalCredit}>{SPLASH_CREDIT}</Text>
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
   * Explicit numeric box, not `width` + `aspectRatio` on the Image: a sized
   * frame plus an absolutely-filled child cannot fall back to the asset's
   * intrinsic 2171px width, which center-cropped the wordmark to "az".
   */
  royalLogoBox: {
    width: ROYAL_LOGO_W,
    height: ROYAL_LOGO_H,
  },
  royalLogo: {
    width: '100%',
    height: '100%',
  },
  /** Absolutely anchored so the wordmark stays optically centred. */
  royalCredit: {
    position: 'absolute',
    bottom: CREDIT_BOTTOM_INSET,
    alignSelf: 'center',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.3,
    color: parentRamp.onBase,
    opacity: 0.9,
  },
  spinner: {
    marginTop: 16,
  },
});
