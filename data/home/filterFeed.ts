/**
 * @mock Static fixture — seeded sample data for local development until the Go Chi
 * backend (server/) is wired. See data/DATA_CONTROL.md.
 */
import type { Product } from '../types';
import { instantFeed } from './instantFeed';
import { hairSkinPicks } from './demographics';
import { martProducts } from '../mart/products';
import { foodProducts } from '../food/products';
import { groceryProducts } from '../grocery/products';
import { pharmaProducts } from '../pharma/products';
import { foodStores } from '../food/stores';
import { categoriesSearchDatabase } from '../categories/searchDatabase';

// Filter-chip feed pools. Each chip draws real items from the per-app catalogs
// (plus curated home pools like instantFeed / hairSkinPicks), never new mocks.
// Items keep their native `app`, so UniversalFeedCard renders the right skin.

function dedupe(items: Product[]): Product[] {
  const seen = new Set<string>();
  const out: Product[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

// "Hot Meals" = currently-hot / ready-now signature dishes from the fastest
// food stores (<= 30 min delivery). Each store becomes a derived product entry
// reusing its own fields; price is a realistic catalogue-consistent estimate.
const READY_NOW_STORE_TIMES = [30, 25, 20, 15];
const readyNowStores = foodStores
  .filter((s) => READY_NOW_STORE_TIMES.some((t) => s.deliveryTime === `${t} min`))
  .slice(0, 4);

const hotMeals: Product[] = readyNowStores.map((s, i) => ({
  id: `hm-${s.id}`,
  app: 'FOOD',
  category: s.categories[0] || 'Featured',
  name:
    s.id === 'store-f1' ? 'Royal Awadhi Mutton Biryani'
    : s.id === 'store-f2' ? 'Pure Veg North-South Thali'
    : s.id === 'store-f3' ? 'Gourmet Smash Burger & Loaded Fries'
    : 'Fresh Baked French Pastry Box',
  price: s.id === 'store-f1' ? 350 : s.id === 'store-f2' ? 260 : s.id === 'store-f3' ? 240 : 220,
  originalPrice: (s.id === 'store-f1' ? 350 : s.id === 'store-f2' ? 260 : s.id === 'store-f3' ? 240 : 220) + 80,
  emoji: s.emoji,
  rating: s.rating,
  desc: s.desc,
  image: s.coverImage,
  shop: s.name,
  badge: 'Ready Now',
  badgeBg: 'bg-green-600',
  reviewsCount: s.reviewsCount,
}));

const topRatedAcrossApps = dedupe([
  ...martProducts.filter((p) => p.rating >= 4.8),
  ...foodProducts.filter((p) => p.rating >= 4.8),
  ...groceryProducts.filter((p) => p.rating >= 4.8),
  ...pharmaProducts.filter((p) => p.rating >= 4.8),
]);

const trending = dedupe([
  ...martProducts.filter((p) => p.badge === 'Trending'),
  ...instantFeed.filter((p) => p.badge === 'Trending'),
]);

const freshVeggies = dedupe([
  ...groceryProducts.filter((p) => p.category === 'Fresh Produce'),
  ...(categoriesSearchDatabase['groc-green'] || []),
]);

const fastFood = categoriesSearchDatabase['food-snack'] || [];

const snacks = groceryProducts.filter((p) => p.category === 'Snacks');

const coughSyrup = pharmaProducts.filter((p) => p.category === 'cough');

export interface FilterChip {
  id: string;
  label: string;
  accent: string;
}

export const filterChips: FilterChip[] = [
  { id: 'forYou', label: 'For You', accent: '#8B5CF6' },
  { id: 'trendy', label: 'Trendy', accent: '#8B5CF6' },
  { id: 'fashion', label: 'Fashion', accent: '#1162D3' },
  { id: 'homeAppliances', label: 'Home Appliances', accent: '#1162D3' },
  { id: 'fastFood', label: 'Fast Food', accent: '#C2410C' },
  { id: 'snacks', label: 'Snacks', accent: '#10B981' },
  { id: 'hotMeals', label: 'Hot Meals', accent: '#C2410C' },
  { id: 'skincare', label: 'Skincare', accent: '#0F766E' },
  { id: 'freshVeggies', label: 'Fresh Veggies', accent: '#10B981' },
  { id: 'coughSyrup', label: 'Cough Syrup', accent: '#0F766E' },
];

export type FilterChipId = (typeof filterChips)[number]['id'];

export const filterFeedPools: Record<FilterChipId, Product[]> = {
  forYou: dedupe([...instantFeed, ...hairSkinPicks, ...topRatedAcrossApps]),
  trendy: trending,
  fashion: martProducts.filter((p) => p.category === 'Fashion'),
  homeAppliances: martProducts.filter((p) => p.category === 'Home Appliances'),
  fastFood,
  snacks,
  hotMeals,
  skincare: hairSkinPicks,
  freshVeggies,
  coughSyrup,
};
