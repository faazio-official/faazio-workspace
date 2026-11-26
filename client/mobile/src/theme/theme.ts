import { DefaultTheme, type Theme } from '@react-navigation/native';
import { neutral } from './brandTokens';

/**
 * Semantic colour roles used by the theme-aware shell. The customer app ships a
 * single fixed light palette; there is no dark mode or appearance preference.
 */
export interface AppPalette {
  mode: 'light';
  /** App window / default screen background. */
  background: string;
  /** Grouped settings canvas. */
  canvas: string;
  /** Alternate surface (rails, subtle fills). */
  surface: string;
  /** Cards, headers, sheets. */
  card: string;
  border: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  /** Brand accent for icons, links, selected states. */
  accent: string;
  /** Soft accent fill (icon boxes, selected rows). */
  accentSoft: string;
  /** High-contrast accent for active tab labels. */
  accentStrong: string;
  onAccent: string;
  coinSurface: string;
  coinText: string;
  flame: string;
  flameInactive: string;
  danger: string;
}

export const lightPalette: AppPalette = {
  mode: 'light',
  background: neutral.card,
  canvas: '#F4F6F9',
  surface: neutral.surface,
  card: neutral.card,
  border: neutral.border,
  text: neutral.ink,
  textMuted: neutral.inkMuted,
  textSubtle: neutral.inkSubtle,
  accent: '#1627E9',
  accentSoft: '#DBEAFE',
  accentStrong: '#08264E',
  onAccent: '#FFFFFF',
  coinSurface: '#FEF3C7',
  coinText: '#B45309',
  flame: '#F97316',
  flameInactive: '#E2E8F0',
  danger: '#B91C1C',
};

/** Dark icons on a light background. */
export function getStatusBarBarStyle(): 'dark-content' {
  return 'dark-content';
}

/**
 * Builds the React Navigation theme for the fixed light palette while preserving
 * the app's custom font family (React Navigation defaults to the system font).
 */
export function createNavigationTheme(fonts: Theme['fonts']): Theme {
  return {
    ...DefaultTheme,
    dark: false,
    colors: {
      ...DefaultTheme.colors,
      primary: lightPalette.accent,
      background: lightPalette.background,
      card: lightPalette.card,
      text: lightPalette.text,
      border: lightPalette.border,
      notification: lightPalette.danger,
    },
    fonts,
  };
}
