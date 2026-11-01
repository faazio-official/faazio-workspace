import { brandRamp, semantic } from '@/theme/brandTokens';

/**
 * Food sub-app design system. Locked to the reference spec:
 * exact palette, 8pt spacing scale, card shadow and radii.
 *
 * Brand colours now derive from `brandRamp.FOOD` rather than being literals.
 * This file used to define its own `#FF4500`, which is how the app ended up
 * with three different Food oranges (`#FF4500` here, `#1E5D44` in
 * `brandTokens`, `#C2410C` in the header). There is one Food anchor now:
 * `#F97316`.
 *
 * Role mapping, matching the four-role ramp:
 *   primary      -> base    (icons, dots, borders, chips — never white text)
 *   primaryDeep  -> deep    (text on light, and fills under white text)
 *   primaryDark  -> pressed
 *   primaryLight -> baseLift
 *   primarySoft  -> tint
 */
const food = brandRamp.FOOD;

export const foodTheme = {
  // Palette — Food anchor from the shared ramp
  background: '#F5F5F5',
  sectionBg: '#FFFFFF',
  card: '#FFFFFF',
  /** Bright anchor. Fill only: 2.80 with white text, 6.37 with ink. */
  primary: food.base,
  /**
   * Dark Food orange for text and for fills that carry white text.
   * Clears AA at 11.25 both on white and under white.
   */
  primaryDeep: food.deep,
  primaryDark: food.pressed,
  primaryLight: food.baseLift,
  primarySoft: food.tint,
  ratingGreen: semantic.success,
  ratingGreenSoft: '#DCFCE7',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  lightText: '#9CA3AF',
  iconGrey: '#6B7280',
  favouriteHeart: '#FFFFFF',
  divider: '#ECECEC',
  dotInactive: '#D1D5DB',
  danger: semantic.danger,
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
  sectionGap: 14,
  cardGap: 12,
  cardPad: 12,
  // Grid: card width = (screenWidth - 48) / 2 → 16 page-pad ×2 + 16 gap = 48
  gridGapH: 16,
  gridGapV: 16,
} as const;
