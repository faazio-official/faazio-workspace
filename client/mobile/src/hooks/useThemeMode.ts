import { getStatusBarBarStyle, lightPalette, type AppPalette } from '@/theme/theme';

export interface UseThemeModeResult {
  /** Semantic colour roles for the fixed light palette. */
  palette: AppPalette;
  /** Status-bar icon style (always dark icons on the light background). */
  barStyle: 'dark-content';
}

/**
 * Single read path for the app palette. The customer app has no dark mode or
 * appearance preference: every screen paints the fixed light palette.
 */
export function useThemeMode(): UseThemeModeResult {
  return {
    palette: lightPalette,
    barStyle: getStatusBarBarStyle(),
  };
}
