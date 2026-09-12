import { Platform, StyleSheet } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import { useFonts } from 'expo-font';
import {
  Roboto_400Regular,
  Roboto_500Medium,
  Roboto_600SemiBold,
  Roboto_700Bold,
  Roboto_800ExtraBold,
  Roboto_900Black,
} from '@expo-google-fonts/roboto';

// Only the Roboto weights actually used by the app (grep of `fontWeight` usage).
// Loading fewer assets trims startup font-loading work. iOS resolves to 'System',
// so no Roboto assets are loaded there at all.
export const FONT_ASSETS = {
  Roboto_400Regular,
  Roboto_500Medium,
  Roboto_600SemiBold,
  Roboto_700Bold,
  Roboto_800ExtraBold,
  Roboto_900Black,
} as const;

const ANDROID_FONT_BY_WEIGHT: Record<string, string> = {
  '400': 'Roboto_400Regular',
  '500': 'Roboto_500Medium',
  '600': 'Roboto_600SemiBold',
  '700': 'Roboto_700Bold',
  '800': 'Roboto_800ExtraBold',
  '900': 'Roboto_900Black',
};

function normalizeWeight(weight?: TextStyle['fontWeight']): string {
  if (!weight) return '400';
  if (weight === 'normal') return '400';
  if (weight === 'bold') return '700';
  if (typeof weight === 'number') return String(weight);
  return weight;
}

export function resolveFontFamily(weight?: TextStyle['fontWeight']): string {
  if (Platform.OS === 'ios') return 'System';
  return ANDROID_FONT_BY_WEIGHT[normalizeWeight(weight)] ?? 'Roboto_400Regular';
}

export function resolveTextStyle(style: StyleProp<TextStyle>): StyleProp<TextStyle> {
  const flat = StyleSheet.flatten(style);
  if (!flat) return style;
  if (typeof flat.fontFamily === 'string') {
    return style;
  }
  if (Platform.OS === 'ios') {
    return [{ fontFamily: 'System' }, style];
  }
  const resolved: TextStyle = { ...flat };
  resolved.fontFamily = resolveFontFamily(flat.fontWeight);
  delete resolved.fontWeight;
  return resolved;
}

// Loads the app fonts, gated to Android. On iOS everything resolves to 'System',
// so no Roboto assets are requested (instant resolve, no startup waste).
export function useAppFonts(): [boolean, Error | null] {
  return useFonts(Platform.OS === 'ios' ? {} : FONT_ASSETS);
}
