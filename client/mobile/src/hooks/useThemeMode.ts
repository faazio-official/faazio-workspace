import { useEffect } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { useThemeStore } from '@/state/themeStore';
import {
  getPalette,
  getStatusBarBarStyle,
  resolveEffectiveMode,
  type AppPalette,
  type EffectiveTheme,
  type ThemeMode,
} from '@/theme/theme';

export interface UseThemeModeResult {
  /** Stored preference: light | dark | auto. */
  themeMode: ThemeMode;
  /** Painted scheme after resolving `auto` against the device. */
  effectiveMode: EffectiveTheme;
  /** Semantic colour roles for the painted scheme. */
  palette: AppPalette;
  /** Status-bar icon style for the painted scheme. */
  barStyle: 'light-content' | 'dark-content';
  setThemeMode: (mode: ThemeMode) => void;
}

/**
 * Single read path for the appearance preference. Subscribes to the device
 * scheme for `auto`, and keeps the native surface (alerts, keyboards, Android
 * DayNight) aligned with the chosen preference via Appearance.setColorScheme.
 */
export function useThemeMode(): UseThemeModeResult {
  const themeMode = useThemeStore((s) => s.themeMode);
  const setThemeMode = useThemeStore((s) => s.setThemeMode);
  const systemScheme = useColorScheme();
  const effectiveMode = resolveEffectiveMode(themeMode, systemScheme);

  useEffect(() => {
    Appearance.setColorScheme(themeMode === 'auto' ? 'unspecified' : themeMode);
  }, [themeMode]);

  return {
    themeMode,
    effectiveMode,
    palette: getPalette(effectiveMode),
    barStyle: getStatusBarBarStyle(effectiveMode),
    setThemeMode,
  };
}
