/**
 * Tamil font bundle.
 *
 * Hind Madurai (SIL OFL 1.1, Indian Type Foundry) is bundled so Tamil copy renders with a real
 * Tamil face and the app's own weight ladder on both platforms — the OS fallback (Noto Sans Tamil
 * on Android, Tamil Sangam MN on iOS) has no matching `fontWeight`, so bold/medium Tamil text
 * degraded to a synthetic face. The family also carries Latin glyphs, so a Tamil-selected app
 * does not mix two typefaces.
 *
 * Files live in `assets/fonts/` and are registered with:
 *   - Android → `android/app/src/main/assets/fonts/` (compiled into the APK by Gradle).
 *   - iOS     → `ios/Faazio/Fonts/` + `UIAppFonts` in `ios/Faazio/Info.plist` (copied by the
 *               `Resources` build phase).
 *
 * No async font gate: the faces are embedded natively, so the first frame already has them.
 */

import type { TextStyle } from 'react-native';

const TAMIL_FONT_FAMILY = 'HindMadurai';

/** PostScript names — what React Native resolves `fontFamily` to on each platform. */
const WEIGHT_FAMILY: Record<'regular' | 'medium' | 'semibold' | 'bold', string> = {
  regular: 'HindMadurai-Regular',
  medium: 'HindMadurai-Medium',
  semibold: 'HindMadurai-SemiBold',
  bold: 'HindMadurai-Bold',
};

/**
 * Resolves the bundled Tamil face for a weight. `fontWeight` must NOT be combined with a bundled
 * family on Android (it re-selects a synthetic face), so callers that use this family drop the
 * weight property — see `fonts.ts` `resolveTextStyle`.
 */
export function tamilFontFamilyForWeight(weight?: TextStyle['fontWeight'] | string | number): string {
  switch (String(weight)) {
    case '500':
      return WEIGHT_FAMILY.medium;
    case '600':
      return WEIGHT_FAMILY.semibold;
    case '700':
    case '800':
    case '900':
      return WEIGHT_FAMILY.bold;
    default:
      return WEIGHT_FAMILY.regular;
  }
}

/** The base Tamil family name (used where a single family must be named, e.g. nav themes). */
export function tamilFontFamily(): string {
  return TAMIL_FONT_FAMILY;
}
