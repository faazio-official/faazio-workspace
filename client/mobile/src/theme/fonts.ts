import { Platform, StyleSheet } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';

// Roboto is the Android system font family; iOS resolves to 'System'. Using the
// platform fonts removes the custom font native module and the startup font-load
// gate entirely (no async asset load, no splash extension for fonts). The
// per-weight faces (400/500/700/800/900) are requested via `fontWeight`, which
// modern Android resolves against the system Roboto family.
const ANDROID_FONT_FAMILY = 'sans-serif';

export function resolveFontFamily(_weight?: TextStyle['fontWeight']): string {
  if (Platform.OS === 'ios') return 'System';
  return ANDROID_FONT_FAMILY;
}

export function resolveTextStyle(style: StyleProp<TextStyle>): StyleProp<TextStyle> {
  const flat = StyleSheet.flatten(style);
  if (!flat) return style;
  if (typeof flat.fontFamily === 'string') {
    return style;
  }
  return [{ fontFamily: resolveFontFamily(flat.fontWeight) }, style];
}

/**
 * Fonts are provided by the platform, so there is nothing to await. Kept as a
 * hook so `App.tsx` does not need to know that the loading gate is gone.
 */
export function useAppFonts(): [boolean, Error | null] {
  return [true, null];
}
