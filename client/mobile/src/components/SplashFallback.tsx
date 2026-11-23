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

/**
 * Bottom credit line. Split into a quiet lead-in and the studio name so the
 * hierarchy comes from weight and colour, not from a second size on the line.
 * The inset matches the native layer so the handoff keeps the same anchor.
 */
const CREDIT_LABEL = 'Product of';
const CREDIT_BRAND = 'FA CREATORS';
const CREDIT_FONT_SIZE = 13;
/** Caps tracking on the studio name; negated at the end so the row stays optically centred. */
const CREDIT_BRAND_TRACKING = 1.4;
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
        <View style={styles.royalCreditRow}>
          <Text style={styles.royalCreditLabel}>{CREDIT_LABEL}</Text>
          <Text style={styles.royalCreditBrand}>{CREDIT_BRAND}</Text>
        </View>
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
  /**
   * One baseline for both runs, so the credit reads as a single line of type
   * rather than two stacked labels. Absolutely anchored at the native layer's
   * 56pt inset so the handoff does not shift the line.
   */
  royalCreditRow: {
    position: 'absolute',
    bottom: CREDIT_BOTTOM_INSET,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  royalCreditLabel: {
    fontSize: CREDIT_FONT_SIZE,
    fontWeight: '400',
    letterSpacing: 0.2,
    color: parentRamp.onBase,
    opacity: 0.78,
  },
  royalCreditBrand: {
    marginLeft: 5,
    /** Cancels the trailing tracking so the row stays optically centred. */
    marginRight: -CREDIT_BRAND_TRACKING,
    fontSize: CREDIT_FONT_SIZE,
    fontWeight: '600',
    letterSpacing: CREDIT_BRAND_TRACKING,
    color: parentRamp.onBase,
  },
  spinner: {
    marginTop: 16,
  },
});
