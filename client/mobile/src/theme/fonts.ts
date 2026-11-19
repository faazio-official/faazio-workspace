import { Children, isValidElement } from 'react';
import type { ReactNode } from 'react';
import { Platform, StyleSheet } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import { tamilFontFamilyForWeight } from './tamilFont';

// Roboto is the Android system font family; iOS resolves to 'System'. Latin copy uses these platform
// families through `fontWeight` (400/500/700/800/900), which modern Android resolves against Roboto.
// Tamil copy uses the bundled Hind Madurai faces instead — they are embedded natively, so there is
// still no font module and no async load gate.
const ANDROID_FONT_FAMILY = 'sans-serif';

// Tamil copy is authored by sellers/admins and arrives on any screen. A dedicated Tamil face is
// bundled (Hind Madurai, OFL) because neither Roboto nor San Francisco carries Tamil glyphs and the
// OS substitute loses the app's weight ladder. See `theme/tamilFont.ts` for the asset registration.
const TAMIL_CODE_POINT = /[\u0B80-\u0BFF]/;

/** True when `text` contains at least one character from the Tamil Unicode block. */
export function containsTamil(text: string): boolean {
  return TAMIL_CODE_POINT.test(text);
}

/** Recursively detects Tamil text in a React child tree (strings, arrays, elements). */
export function childrenContainTamil(children: ReactNode): boolean {
  let found = false;
  Children.forEach(children, (child: ReactNode) => {
    if (found || child === null || child === undefined || typeof child === 'boolean') return;
    if (typeof child === 'string' || typeof child === 'number') {
      found = containsTamil(String(child));
      return;
    }
    if (Array.isArray(child)) {
      found = childrenContainTamil(child);
      return;
    }
    if (isValidElement(child)) {
      const nested = (child.props as { children?: ReactNode }).children;
      if (nested !== undefined) found = childrenContainTamil(nested);
    }
  });
  return found;
}

/** The platform family for Latin copy (Roboto on Android, `System` on iOS). */
export function resolveFontFamily(_weight?: TextStyle['fontWeight']): string {
  if (Platform.OS === 'ios') return 'System';
  return ANDROID_FONT_FAMILY;
}

/**
 * Navigation chrome fonts. React Navigation defaults to the system font, so the app builds this
 * map once per language: Tamil selection swaps every chrome face to the bundled Tamil family.
 */
export function createNavigationFonts(tamil: boolean): Record<
  'regular' | 'medium' | 'bold' | 'heavy',
  { fontFamily: string; fontWeight: TextStyle['fontWeight'] }
> {
  if (!tamil) {
    return {
      regular: { fontFamily: resolveFontFamily('400'), fontWeight: '400' },
      medium: { fontFamily: resolveFontFamily('500'), fontWeight: '500' },
      bold: { fontFamily: resolveFontFamily('600'), fontWeight: '600' },
      heavy: { fontFamily: resolveFontFamily('600'), fontWeight: '600' },
    };
  }
  // A bundled family supplies the weight through its own file. Naming `fontWeight` next to it makes
  // Android synthesise a second face on top of the real one, so the weight key stays unset.
  const face = (weight: TextStyle['fontWeight']) => ({
    fontFamily: tamilFontFamilyForWeight(weight),
    fontWeight: undefined,
  });
  return {
    regular: face('400'),
    medium: face('500'),
    bold: face('600'),
    heavy: face('600'),
  };
}

/**
 * Resolves the family for one text node. Tamil content wins over the platform default so the
 * script renders with the bundled face; everything else keeps the platform family untouched.
 */
export function resolveFontFamilyForText(
  text: string,
  weight?: TextStyle['fontWeight'],
): string {
  return containsTamil(text) ? tamilFontFamilyForWeight(weight) : resolveFontFamily(weight);
}

export function resolveTextStyle(
  style: StyleProp<TextStyle>,
  forceTamil = false,
): StyleProp<TextStyle> {
  const flat = StyleSheet.flatten(style);
  if (!flat) return style;
  if (typeof flat.fontFamily === 'string') {
    return style;
  }
  if (forceTamil) {
    // The bundled face already encodes the weight. The reset must come *after* `style` because a
    // later entry wins in a style array — prepending it would let the caller's `fontWeight` through
    // again and Android would synthesise a second face on top of the real one.
    return [style, { fontFamily: tamilFontFamilyForWeight(flat.fontWeight), fontWeight: undefined }];
  }
  return [{ fontFamily: resolveFontFamily(flat.fontWeight) }, style];
}

/**
 * Fonts are embedded natively (Android `assets/fonts`, iOS `UIAppFonts`), so there is nothing to
 * await. Kept as a hook so `App.tsx` does not need to know that the loading gate is gone.
 */
export function useAppFonts(): [boolean, Error | null] {
  return [true, null];
}
