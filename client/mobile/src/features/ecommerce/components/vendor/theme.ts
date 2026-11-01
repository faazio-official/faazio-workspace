import { brandRamp, semantic } from '@/theme/brandTokens';

/**
 * Vendor-surface colours.
 *
 * These used to be standalone literals, which is how the app ended up with six
 * definitions of two brand colours. They now derive from `brandRamp` so there is
 * one source of truth per brand.
 *
 * `VENDOR_YELLOW` is the Mart anchor and is a FILL ONLY — it reads 1.63 on white
 * and cannot carry text or sit on a light surface. Use `VENDOR_INK` for icons and
 * text on light backgrounds.
 */
export const VENDOR_YELLOW = brandRamp.MART.base;
/** Mart ink for icons/text on light surfaces (8.53 on white). */
export const VENDOR_INK = brandRamp.MART.deep;
/** Slightly lighter Mart ink, for pressed/secondary emphasis. */
export const VENDOR_ACCENT = brandRamp.MART.pressed;

export const VENDOR_GRADIENT: [string, string] = [brandRamp.MART.deep, brandRamp.MART.base];

export const GREEN = semantic.success;
export const RED = semantic.danger;
export const TEXT_DARK = '#1F2937';
export const TEXT_LIGHT = '#6B7280';
export const BG_GRAY = '#F9FAFB';
