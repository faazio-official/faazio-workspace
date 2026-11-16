import {
  neutral,
  parentRamp,
  semantic,
  semanticTint,
} from '@/theme/brandTokens';
import { RADIUS, SHADOW_COLOR, TOUCH, TYPE } from '@/theme/tokens';
import { SPACE } from '@/theme/spacing';
import { ms } from '@/utils/responsive';

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
  /** Shadow ink. The one correct place for literal black; screens must not repeat it. */
  shadow: SHADOW_COLOR,
} as const;

/**
 * Delivery type scale — derived from the shared `TYPE` scale (never a parallel
 * copy), with the delivery-specific `micro`, `timer` and `code` roles layered on
 * top. There is deliberately no `kicker`/eyebrow role: titles carry their own
 * hierarchy and no small label sits above a title.
 *
 * Hierarchy comes from size and colour, not weight: the shared weights already
 * stay within 400–600 (`docs/UI_DESIGN_SYSTEM.md` §3 Pass 5 — no 700–900
 * headings), so each role only carries the delivery intent it needs.
 */
export const DP_TYPE = {
  caption: { ...TYPE.caption, fontWeight: '500' },
  body: { ...TYPE.body },
  label: { ...TYPE.label },
  title: { ...TYPE.title, fontWeight: '600' },
  display: { ...TYPE.display },
  /** Micro label for pills, badges, tab labels, field labels and timers (11 dp floor). */
  micro: { ...TYPE.micro },
  /** Tabular countdown weight for the 45 s offer timer. */
  timer: { ...TYPE.display, fontWeight: '600' },
  /** Oversized numeric glyph for the OTP entry segments. */
  code: { fontSize: ms(26), lineHeight: ms(32), fontWeight: '600' },
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
