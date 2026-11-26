import {
  createNavigationTheme,
  getStatusBarBarStyle,
  lightPalette,
} from '@/theme/theme';

describe('theme palette', () => {
  it('ships a single fixed light palette', () => {
    expect(lightPalette.mode).toBe('light');
    expect(lightPalette.background).toBe('#FFFFFF');
  });

  it('uses dark status-bar icons on the light background', () => {
    expect(getStatusBarBarStyle()).toBe('dark-content');
  });

  it('builds a light navigation theme', () => {
    const fonts = {
      regular: { fontFamily: 'Regular', fontWeight: '400' as const },
      medium: { fontFamily: 'Medium', fontWeight: '500' as const },
      bold: { fontFamily: 'Bold', fontWeight: '600' as const },
      heavy: { fontFamily: 'Heavy', fontWeight: '600' as const },
    };

    const theme = createNavigationTheme(fonts);

    expect(theme.dark).toBe(false);
    expect(theme.colors.background).toBe(lightPalette.background);
    expect(theme.colors.text).toBe(lightPalette.text);
    expect(theme.fonts).toEqual(fonts);
  });
});
