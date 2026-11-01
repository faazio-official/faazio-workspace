import type { AppBrand } from '@data/types';

export interface BrandTokens {
  accent: string;
  accentDark: string;
  accentLight?: string;
  cardBg: string;
  badgeBg: string;
  btnBg: string;
  btnText: string;
  btnAdded: string;
  gradient: [string, string];
  headerGradient: [string, string];
  headerTextColor: string;
  /**
   * Active tab icon/label colour. Must clear 4.5:1 on the white tab bar.
   * This is deliberately NOT `headerGradient[0]`: the header gradient's first
   * stop is tuned to carry `headerTextColor` on the header, which is a different
   * pairing. Mart's #CA8A04 reads 2.94 on white and fails as a tab colour.
   */
  tabActiveColor: string;
  priceColor: string;
  pillBg: string;
}

/* -------------------------------------------------------------------------
 * Legacy token surface — every field now points at a ramp role
 * -------------------------------------------------------------------------
 * Field names are kept so no consumer has to change, but each value is now the
 * ramp role that is correct for how the field is actually used:
 *
 *   accent / btnBg / priceColor / tabActiveColor -> `deep`
 *       All four are read as a fill under white text, or as text on white. The
 *       bright anchor fails both (Mart 1.63, Pharma 2.49, Food 2.80 on white),
 *       so none of them may carry `base`.
 *   badgeBg / accentLight                       -> `base`
 *       Fill only, never under white text. This is what the anchor is for.
 *   accentDark                                  -> `pressed`
 *   cardBg / pillBg                             -> `tint`
 *   btnAdded                                    -> semantic.success
 *   headerGradient + headerTextColor            -> base -> baseLift, dark ink
 *
 * Values stay as literals rather than `brandRamp.X.base` so
 * `scripts/check-brand-contrast.mjs` can re-derive every ratio from the source
 * text and fail if one is edited into an illegal pairing. The ramp below is the
 * source of truth; these are its projections.
 */
export const brandTokens: Record<AppBrand, BrandTokens> = {
  FOOD: {
    accent: '#622B05', // deep
    accentDark: '#471F04', // pressed
    cardBg: '#FCE9D8', // tint
    badgeBg: '#F97316', // base (fill only)
    btnBg: '#622B05', // deep
    btnText: '#ffffff',
    btnAdded: '#15803D', // semantic.success
    gradient: ['#622B05', '#F97316'],
    /** base -> baseLift. Carries headerTextColor (#0F172A) at 6.37 / 9.02. */
    headerGradient: ['#F97316', '#FBA468'],
    headerTextColor: '#0F172A',
    tabActiveColor: '#622B05', // deep, 11.25 on the white tab bar
    priceColor: '#622B05', // deep, 11.25 on white
    pillBg: '#FCE9D8', // tint
  },
  MART: {
    accent: '#614902', // deep
    accentDark: '#463401', // pressed
    cardBg: '#FFFAE0', // tint
    badgeBg: '#FFC107', // base (fill only)
    btnBg: '#614902', // deep
    btnText: '#ffffff',
    btnAdded: '#15803D', // semantic.success
    gradient: ['#614902', '#FFC107'],
    /** base -> baseLift. Carries headerTextColor (#0F172A) at 10.95 / 12.87. */
    headerGradient: ['#FFC107', '#FFD75E'],
    headerTextColor: '#0F172A',
    tabActiveColor: '#614902', // deep, 8.53 on the white tab bar
    priceColor: '#614902', // deep, 8.53 on white
    pillBg: '#FFFAE0', // tint
  },
  PHARMA: {
    accent: '#09443E', // deep
    accentDark: '#062B27', // pressed
    accentLight: '#14B8A6', // base (fill only)
    cardBg: '#E9FBF9', // tint
    badgeBg: '#14B8A6', // base (fill only)
    btnBg: '#09443E', // deep
    btnText: '#ffffff',
    btnAdded: '#15803D', // semantic.success
    gradient: ['#09443E', '#14B8A6'],
    /** base -> baseLift. Carries headerTextColor (#0F172A) at 7.17 / 9.77. */
    headerGradient: ['#14B8A6', '#66D1C5'],
    headerTextColor: '#0F172A',
    tabActiveColor: '#09443E', // deep, 11.01 on the white tab bar
    priceColor: '#09443E', // deep, 11.01 on white
    pillBg: '#E9FBF9', // tint
  },
};

/* -------------------------------------------------------------------------
 * Four-role brand ramp
 * -------------------------------------------------------------------------
 * Every brand anchor is bright, so it can never carry white text. Measured
 * white-on-base: Mart 1.63, Pharma 2.49, Food 2.80, Parent 5.66. The anchor is
 * therefore a FILL colour (icons, chips, badges, accents) and never a button
 * background under white text.
 *
 * Buttons use `deep`, which carries white text at AA everywhere:
 * Mart 8.53, Pharma 11.01, Food 11.25, Parent 15.03.
 *
 * `pressed` is derived from `deep`, NOT from `base`. Darkening the bright base
 * produces colours that fail their own rule (Mart 2.65, Food 4.23 on white).
 *
 * `tint` is a card/pill background and always pairs with `onTint` text.
 *
 * These are additive: nothing in the app consumes them yet. `brandTokens`
 * above is unchanged apart from Pharma's `btnBg` contrast fix.
 */
export interface BrandRamp {
  /** Bright anchor. Fills, icons, chips, badges, accents. Never white text. */
  base: string;
  /** Text/icon colour that sits ON `base`. */
  onBase: string;
  /**
   * `base` lightened 35% toward white. The second stop of the header gradient,
   * used only to give the bright header a little depth. Still a bright surface,
   * so it still carries `onBase` and never white text (Mart 12.87, Pharma 9.77,
   * Food 9.02 with #0F172A).
   */
  baseLift: string;
  /** Dark CTA fill. Carries white text at AA or better. */
  deep: string;
  /** Text/icon colour that sits ON `deep`. */
  onDeep: string;
  /** :active / pressed state of `deep`. Also carries white text. */
  pressed: string;
  /** Soft card/pill background. */
  tint: string;
  /** Body text colour that sits ON `tint`. */
  onTint: string;
}

export const brandRamp: Record<AppBrand, BrandRamp> = {
  MART: {
    base: '#FFC107',
    onBase: '#0F172A',
    baseLift: '#FFD75E',
    deep: '#614902',
    onDeep: '#FFFFFF',
    pressed: '#463401',
    tint: '#FFFAE0',
    onTint: '#0F172A',
  },
  PHARMA: {
    base: '#14B8A6',
    onBase: '#0F172A',
    baseLift: '#66D1C5',
    deep: '#09443E',
    onDeep: '#FFFFFF',
    pressed: '#062B27',
    tint: '#E9FBF9',
    onTint: '#0F172A',
  },
  FOOD: {
    base: '#F97316',
    onBase: '#0F172A',
    baseLift: '#FBA468',
    deep: '#622B05',
    onDeep: '#FFFFFF',
    pressed: '#471F04',
    tint: '#FCE9D8',
    onTint: '#0F172A',
  },
};

/**
 * The Faazio parent brand. Not an `AppBrand` (it is the shell, not a sub-app),
 * so it lives beside the ramp rather than inside it.
 *
 * Parent blue is the one anchor that CAN carry white text (5.66), so `onBase`
 * is white here rather than ink. `baseLift` is unused by the parent today and
 * is provided only to keep the shape uniform.
 */
export const parentRamp: BrandRamp = {
  base: '#1162D3',
  onBase: '#FFFFFF',
  baseLift: '#6499E2',
  deep: '#08264E',
  onDeep: '#FFFFFF',
  pressed: '#051A35',
  tint: '#E8F1FC',
  onTint: '#0F172A',
};

/* -------------------------------------------------------------------------
 * Semantic colours — identical across every sub-app
 * -------------------------------------------------------------------------
 * Meaning must not drift per sub-app, or a red error in Pharma stops meaning
 * the same thing as a red error in Mart. Each clears white text at AA and sits
 * at dE 30+ from all four anchors, so none of them reads as branding.
 *
 * warning is #854D0E rather than #D97706 because #D97706 is dE 15.4 from the
 * Food anchor — a warning toast in Food would have looked like branding.
 * info is #4338CA rather than #2563EB because #2563EB is dE 13.9 from the
 * parent blue.
 */
export const semantic = {
  success: '#15803D',
  danger: '#B91C1C',
  warning: '#854D0E',
  info: '#4338CA',
  neutral: '#475569',
} as const;

/** Soft backgrounds for the semantic roles, paired with the role colour as text. */
export const semanticTint = {
  success: '#DCFCE7',
  danger: '#FEE2E2',
  warning: '#FEF3C7',
  info: '#E0E7FF',
  neutral: '#F1F5F9',
} as const;

/* -------------------------------------------------------------------------
 * Neutrals — one shared set, never tinted per sub-app
 * -------------------------------------------------------------------------
 * Tinting neutrals per sub-app is what makes three apps look like three
 * different products instead of one product in three modes.
 */
export const neutral = {
  ink: '#0F172A',
  inkMuted: '#475569',
  inkSubtle: '#7C8CA1',
  border: '#E2E8F0',
  surfaceAlt: '#F1F5F9',
  surface: '#F8FAFC',
  card: '#FFFFFF',
} as const;
