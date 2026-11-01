/**
 * Categorical palette for product-category icons.
 *
 * This is NOT brand colour. It exists because 23 categories rendered in one hue
 * would be unreadable, so the icons need to be distinguishable from each other
 * rather than from the brand.
 *
 * Two rules hold it together:
 *
 * 1. No entry may equal or sit within dE 10 of a brand anchor. The three
 *    sub-app anchors are reserved for the three category icons (see
 *    `EnterpriseIcon.tsx`), so a product icon in the same hue would read as
 *    branding.
 * 2. The three that used to collide as near-identical greens are now separated
 *    across green / cyan / amber: 🍏 is green, 💎 is cyan, ⌚ is amber. They were
 *    #10B981, #0d9488 and #0f766e — three greens within dE 25 of each other.
 *
 * Every value clears 3:1 against white, which is the non-text contrast minimum
 * for a meaningful icon. They are not required to clear 4.5:1 because they are
 * never used as text.
 */
export const categorical = {
  green: '#15803D',
  cyan: '#0E7490',
  teal: '#0F766E',
  blue: '#1D4ED8',
  indigo: '#4338CA',
  violet: '#6D28D9',
  purple: '#7E22CE',
  pink: '#BE185D',
  rose: '#BE123C',
  red: '#B91C1C',
  orange: '#C2410C',
  amber: '#A16207',
  brown: '#92400E',
  slate: '#475569',
} as const;
