import { Platform, StyleSheet } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import {
  Roboto_100Thin,
  Roboto_200ExtraLight,
  Roboto_300Light,
  Roboto_400Regular,
  Roboto_500Medium,
  Roboto_600SemiBold,
  Roboto_700Bold,
  Roboto_800ExtraBold,
  Roboto_900Black,
} from '@expo-google-fonts/roboto';

export const FONT_ASSETS = {
  Roboto_100Thin,
  Roboto_200ExtraLight,
  Roboto_300Light,
  Roboto_400Regular,
  Roboto_500Medium,
  Roboto_600SemiBold,
  Roboto_700Bold,
  Roboto_800ExtraBold,
  Roboto_900Black,
} as const;

const ANDROID_FONT_BY_WEIGHT: Record<string, string> = {
  '100': 'Roboto_100Thin',
  '200': 'Roboto_200ExtraLight',
  '300': 'Roboto_300Light',
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
