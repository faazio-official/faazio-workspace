import { brandTokens } from './brandTokens';
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

const badgeHexMap: Record<string, string> = {
  'bg-amber': '#F59E0B',
  'bg-red': '#EF4444',
  'bg-green': '#10B981',
  'bg-blue': '#3B82F6',
  'bg-purple': '#8B5CF6',
  'bg-pink': '#EC4899',
  'bg-indigo': '#6366F1',
  'bg-teal': '#14B8A6',
  'bg-orange': '#F97316',
  'bg-gray': '#6B7280',
};

export function resolveBadgeBg(badgeBg?: string): string {
  if (!badgeBg) return '#6B7280';
  if (badgeBg.startsWith('#')) return badgeBg;
  return badgeHexMap[badgeBg] || '#6B7280';
}
