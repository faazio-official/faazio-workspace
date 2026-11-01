import { brandTokens, semantic } from '@/theme/brandTokens';
import type { AppBrand } from '@data/types';

export function formatPrice(price: number, locale = 'en-IN', currency = 'INR') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatRating(rating: number, decimals = 1) {
  return rating.toFixed(decimals);
}

/**
 * Named badge fills. These are read as a background under white badge text, so
 * every value must clear 4.5:1 against white — which is why they come from the
 * shared `semantic` set rather than Tailwind's 500-level shades. The old
 * `#10B981` here carried white at 2.54 and failed.
 */
const badgeHexMap: Record<string, string> = {
  'bg-amber': semantic.warning,
  'bg-red': semantic.danger,
  'bg-green': semantic.success,
  'bg-blue': semantic.info,
  'bg-purple': '#6D28D9',
  'bg-pink': '#BE185D',
  'bg-indigo': '#4338CA',
  'bg-teal': '#0F766E',
  'bg-orange': '#C2410C',
  'bg-gray': semantic.neutral,
};

export function resolveBadgeBg(badgeBg?: string): string {
  if (!badgeBg) return semantic.neutral;
  if (badgeBg.startsWith('#')) return badgeBg;
  return badgeHexMap[badgeBg] || semantic.neutral;
}
