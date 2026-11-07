import { ms } from '@/utils/responsive';
import { neutral } from './brandTokens';

/**
 * Shared design tokens. Colours still come from `brandTokens.ts`; this file
 * adds the pieces every screen was inventing (radii, touch targets, icon sizes
 * and the text roles).
 */

export const RADIUS = {
  xs: ms(4),
  sm: ms(8),
  md: ms(12),
  lg: ms(16),
  xl: ms(20),
  pill: 999,
} as const;

/**
 * Minimum interactive size. Raw dp on purpose: 44pt is a physical target and
 * must not shrink on small screens.
 */
export const TOUCH = {
  min: 44,
  icon: 44,
} as const;

export const ICON = {
  sm: 16,
  md: 20,
  lg: 24,
} as const;

/** Three text roles only. */
export const TEXT = {
  primary: neutral.ink,
  secondary: neutral.inkMuted,
  muted: neutral.inkSubtle,
  inverse: '#FFFFFF',
} as const;

export type TextTone = keyof typeof TEXT;

/**
 * Type scale. Sizes are in dp; 11 is the floor. Hierarchy comes from size and
 * colour, not from 800/900 weights.
 */
export const TYPE = {
  micro: { fontSize: ms(11), lineHeight: ms(15), fontWeight: '500' },
  caption: { fontSize: ms(13), lineHeight: ms(18), fontWeight: '400' },
  body: { fontSize: ms(15), lineHeight: ms(21), fontWeight: '400' },
  label: { fontSize: ms(14), lineHeight: ms(20), fontWeight: '500' },
  title: { fontSize: ms(20), lineHeight: ms(26), fontWeight: '600' },
  display: { fontSize: ms(28), lineHeight: ms(34), fontWeight: '600' },
} as const;

export type TextVariant = keyof typeof TYPE;