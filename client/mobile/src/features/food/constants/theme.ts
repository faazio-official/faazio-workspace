/**
 * Food sub-app design system. Locked to the reference spec:
 * exact palette, 8pt spacing scale, card shadow and radii.
 */
export const foodTheme = {
  // Palette — vibrant red/orange brand (spec: #FF4500)
  background: '#F5F5F5',
  sectionBg: '#FFFFFF',
  card: '#FFFFFF',
  primary: '#FF4500',
  primaryDark: '#E23E00',
  primaryLight: '#FFD1BC',
  primarySoft: '#FF450014',
  ratingGreen: '#16A34A',
  ratingGreenSoft: '#16A34A14',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  lightText: '#9CA3AF',
  iconGrey: '#6B7280',
  favouriteHeart: '#FFFFFF',
  divider: '#ECECEC',
  dotInactive: '#D1D5DB',
  danger: '#E11D48',
  white: '#FFFFFF',
  black: '#000000',
  scrim: 'rgba(0,0,0,0.55)',
  scrimHeavy: 'rgba(0,0,0,0.82)',

  // Card shadow — spec: opacity 0.06 / radius 10 / offset (0,4) / elevation 4
  shadowCard: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 4,
  },
  shadowSoft: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  shadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },

  // Radii — image 18, card 20
  radius: {
    sm: 10,
    md: 14,
    lg: 18,
    xl: 22,
    img: 18,
    card: 20,
    pill: 999,
  },

  // 8pt spacing scale
  sp: {
    4: 4,
    8: 8,
    12: 12,
    16: 16,
    20: 20,
    24: 24,
    28: 28,
    32: 32,
  },
  pagePad: 16,
  sectionGap: 28,
  cardGap: 12,
  cardPad: 12,
  // Grid: card width = (screenWidth - 48) / 2 → 16 page-pad ×2 + 16 gap = 48
  gridGapH: 16,
  gridGapV: 16,
} as const;
