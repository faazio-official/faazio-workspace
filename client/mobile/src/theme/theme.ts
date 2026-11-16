import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';
import { neutral } from './brandTokens';

/**
 * User-selectable appearance preference. `auto` follows the device scheme live;
 * `light` / `dark` pin the app regardless of the OS setting. Default is light.
 */
export type ThemeMode = 'light' | 'dark' | 'auto';

/** The concrete scheme actually painted (an `auto` preference collapses to one). */
export type EffectiveTheme = 'light' | 'dark';

export const DEFAULT_THEME_MODE: ThemeMode = 'light';

export const THEME_MODES: readonly ThemeMode[] = ['light', 'dark', 'auto'] as const;

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && (THEME_MODES as readonly string[]).includes(value);
}

/**
 * Semantic colour roles used by the theme-aware shell and converted screens.
 * One object per effective scheme; screens read roles, never raw literals.
 */
export interface AppPalette {
  mode: EffectiveTheme;
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

export const darkPalette: AppPalette = {
  mode: 'dark',
  background: '#0B1220',
  canvas: '#0B1220',
  surface: '#0F172A',
  card: '#111A2E',
  border: '#243045',
  text: '#F1F5F9',
  textMuted: '#94A3B8',
  textSubtle: '#64748B',
  accent: '#7DA2FF',
  accentSoft: '#16224A',
  accentStrong: '#93B4FF',
  onAccent: '#0B1220',
  coinSurface: '#3B2A0A',
  coinText: '#FBBF24',
  flame: '#F97316',
  flameInactive: '#334155',
  danger: '#F87171',
};

export function getPalette(mode: EffectiveTheme): AppPalette {
  return mode === 'dark' ? darkPalette : lightPalette;
}

/**
 * Collapses a stored preference + the device scheme into what is painted.
 * A null/unknown device scheme (startup) resolves to light, never dark.
 */
export function resolveEffectiveMode(
  mode: ThemeMode,
  systemScheme: 'light' | 'dark' | 'unspecified' | null | undefined,
): EffectiveTheme {
  if (mode === 'auto') return systemScheme === 'dark' ? 'dark' : 'light';
  return mode;
}

/** White icons on a dark background, dark icons on a light background. */
export function getStatusBarBarStyle(
  mode: EffectiveTheme,
): 'light-content' | 'dark-content' {
  return mode === 'dark' ? 'light-content' : 'dark-content';
}

/**
 * Builds the React Navigation theme for the resolved scheme while preserving
 * the app's custom font family (React Navigation defaults to the system font).
 */
export function createNavigationTheme(
  mode: EffectiveTheme,
  fonts: Theme['fonts'],
): Theme {
  const base = mode === 'dark' ? DarkTheme : DefaultTheme;
  const palette = getPalette(mode);
  return {
    ...base,
    dark: mode === 'dark',
    colors: {
      ...base.colors,
      primary: palette.accent,
      background: palette.background,
      card: palette.card,
      text: palette.text,
      border: palette.border,
      notification: palette.danger,
    },
    fonts,
  };
}
