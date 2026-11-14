import { ms } from '@/utils/responsive';
import {
  neutral,
  parentRamp,
  semantic,
  semanticTint,
} from '@/theme/brandTokens';
import { RADIUS, TOUCH } from '@/theme/tokens';
import { SPACE } from '@/theme/spacing';

/**
 * Delivery-partner visual tokens.
 *
 * The Delivery Partner app is a separate product from the customer SuperApp, so it
 * carries its own anchor instead of a per-sub-app `brandTokens` entry. Everything
 * below derives from the parent brand ramp (`parentRamp`) and the shared neutral /
 * semantic sets — no new colour literals — so the rider app is one brand anchor
 * (Faazio Blue `#1627E9`) and kills the old orphan `#2c56f6` hardcode.
 *
 * Design reference: `client/web/Delivery app vite Reference.` mobile view —
 * full-bleed cards on `surface`/`card`, hairline `border`, tone dots, flat brand
 * buttons, full-width rows.
 */
export const DELIVERY = {
  // Brand
  brand: parentRamp.base,
  /** Darkest brand neutral for gradient tails / dark fills (Faazio Blue `pressed`). */
  brandDark: parentRamp.pressed,
  /** Deep brand fill (navy) for hero surfaces carrying white text. */
  brandDeep: parentRamp.deep,
  /** Soft brand wash for chips, tints and selected rows. */
  brandTint: parentRamp.tint,
  onBrand: parentRamp.onBase,
  /** Alias the plan refers to as `card`. */
  card: neutral.card,

  // Ink
  ink: neutral.ink,
  inkMuted: neutral.inkMuted,
  inkSubtle: neutral.inkSubtle,

  // Surfaces
  border: neutral.border,
  surface: neutral.surface,
  surfaceAlt: neutral.surfaceAlt,

  // Semantic ramp
  success: semantic.success,
  successTint: semanticTint.success,
  warning: semantic.warning,
  warningTint: semanticTint.warning,
  danger: semantic.danger,
  dangerTint: semanticTint.danger,
  info: semantic.info,
  infoTint: semanticTint.info,
  neutral: semantic.neutral,
  neutralTint: semanticTint.neutral,

  // Geometry / rhythm (single-sourced, never re-literal'd in screens)
  radius: RADIUS,
  touch: TOUCH,
  space: SPACE,
} as const;

/**
 * Delivery type scale, matching the reference mobile view
 * (caption 11 / body 13 / label 14 / title 18 / display 26).
 */
export const DP_TYPE = {
  caption: { fontSize: ms(11), lineHeight: ms(15), fontWeight: '500' },
  body: { fontSize: ms(13), lineHeight: ms(18), fontWeight: '400' },
  label: { fontSize: ms(14), lineHeight: ms(20), fontWeight: '500' },
  title: { fontSize: ms(18), lineHeight: ms(24), fontWeight: '600' },
  display: { fontSize: ms(26), lineHeight: ms(32), fontWeight: '700' },
  /** Micro label used for kickers / eyebrow copy. */
  kicker: { fontSize: ms(11), lineHeight: ms(15), fontWeight: '700' },
  /** Monospace-ish countdown weight for the 45 s offer timer. */
  timer: { fontSize: ms(28), lineHeight: ms(34), fontWeight: '700' },
} as const;

export type DpTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'brand';

/** Tone → foreground + soft background pair, used by pills, dots and headers. */
export const DP_TONE: Record<DpTone, { fg: string; bg: string }> = {
  neutral: { fg: DELIVERY.neutral, bg: DELIVERY.neutralTint },
  info: { fg: DELIVERY.info, bg: DELIVERY.infoTint },
  success: { fg: DELIVERY.success, bg: DELIVERY.successTint },
  warning: { fg: DELIVERY.warning, bg: DELIVERY.warningTint },
  danger: { fg: DELIVERY.danger, bg: DELIVERY.dangerTint },
  brand: { fg: DELIVERY.brand, bg: DELIVERY.brandTint },
};
