import {
  DEFAULT_THEME_MODE,
  createNavigationTheme,
  getPalette,
  getStatusBarBarStyle,
  isThemeMode,
  resolveEffectiveMode,
  type ThemeMode,
} from '@/theme/theme';

describe('theme preference', () => {
  it('defaults to light', () => {
    expect(DEFAULT_THEME_MODE).toBe('light');
  });

  it('validates stored values', () => {
    (['light', 'dark', 'auto'] as ThemeMode[]).forEach((mode) => {
      expect(isThemeMode(mode)).toBe(true);
    });
    expect(isThemeMode('system')).toBe(false);
    expect(isThemeMode(null)).toBe(false);
    expect(isThemeMode(undefined)).toBe(false);
    expect(isThemeMode('')).toBe(false);
  });

  it('pins explicit modes regardless of the device scheme', () => {
    expect(resolveEffectiveMode('light', 'dark')).toBe('light');
    expect(resolveEffectiveMode('dark', 'light')).toBe('dark');
  });

  it('resolves auto against the device and falls back to light', () => {
    expect(resolveEffectiveMode('auto', 'dark')).toBe('dark');
    expect(resolveEffectiveMode('auto', 'light')).toBe('light');
    expect(resolveEffectiveMode('auto', 'unspecified')).toBe('light');
    expect(resolveEffectiveMode('auto', null)).toBe('light');
    expect(resolveEffectiveMode('auto', undefined)).toBe('light');
  });
});

describe('theme palette', () => {
  it('returns distinct dark and light surfaces', () => {
    expect(getPalette('light').mode).toBe('light');
    expect(getPalette('dark').mode).toBe('dark');
    expect(getPalette('dark').background).not.toBe(getPalette('light').background);
    expect(getPalette('dark').text).not.toBe(getPalette('light').text);
  });

  it('flips status-bar icon style with the scheme', () => {
    expect(getStatusBarBarStyle('light')).toBe('dark-content');
    expect(getStatusBarBarStyle('dark')).toBe('light-content');
  });

  it('builds a navigation theme with the scheme background and dark flag', () => {
    const fonts = {
      regular: { fontFamily: 'Regular', fontWeight: '400' as const },
      medium: { fontFamily: 'Medium', fontWeight: '500' as const },
      bold: { fontFamily: 'Bold', fontWeight: '600' as const },
      heavy: { fontFamily: 'Heavy', fontWeight: '600' as const },
    };

    const light = createNavigationTheme('light', fonts);
    const dark = createNavigationTheme('dark', fonts);

    expect(light.dark).toBe(false);
    expect(dark.dark).toBe(true);
    expect(light.colors.background).toBe(getPalette('light').background);
    expect(dark.colors.background).toBe(getPalette('dark').background);
    expect(dark.colors.text).toBe(getPalette('dark').text);
    expect(dark.fonts).toEqual(fonts);
  });
});
