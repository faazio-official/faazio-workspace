import React from 'react';
import { Soup, Zap, Leaf, Star } from 'lucide-react-native';
import type { SpecialDish } from '@/features/food/mocks/types';
import { TODAYS_SPECIALS } from '@/features/food/mocks/specials';
import { getProductById } from '@data/catalog/products';
import { gateway, type ProductView } from '@/services/api/GatewayClient';
import { withActiveDiscounts } from '@/services/pricing';
import type { DietFilter } from '@/state/foodFilterStore';
import { dishMatches } from '@/features/food/utils/dietFilter';
import SearchDishCard from '@/features/food/components/SearchDishCard';
import type { SearchScreenConfig } from '../types';

/**
 * Map a server FTS result (catalog row, app=FOOD) onto the Food search card shape. The catalog
 * projection drops `isVeg`, so it is recovered from the local `@data` fixture by id when known —
 * a truly server-only row keeps `undefined`, which the diet predicate treats as unclassified
 * (hidden only under an active Veg/Non-Veg filter, never mislabelled). Prices stay server-authoritative.
 */
function viewToDish(p: ProductView): SpecialDish {
  const local = getProductById(p.id);
  const dietary = p.attributes?.dietary;
  const isVeg =
    local?.isVeg !== undefined
      ? local.isVeg
      : dietary === 'Vegetarian'
        ? true
        : dietary === 'Non-Veg'
          ? false
          : undefined;
  const restaurant =
    (p.shop as string | undefined) ?? (p.attributes?.brand as string | undefined) ?? 'Faazio';
  return {
    id: p.id,
    dishName: p.name,
    restaurant,
    price: p.price,
    mrp: p.originalPrice !== undefined && p.originalPrice > p.price ? p.originalPrice : undefined,
    image: p.image,
    isVeg: isVeg as boolean,
    description: p.desc,
    cuisine: p.category,
    rating: p.rating,
  };
}

interface FoodSearchOptions {
  onDishPress?: (dish: SpecialDish) => void;
  /**
   * Active Veg / Non-Veg diet filter. Threaded in explicitly (not read from the
   * store inside the predicate) so the config is deterministic and the
   * predicates stay pure. The caller subscribes to the store and rebuilds the
   * config when it changes.
   */
  dietFilter?: DietFilter;
}

const minutesOf = (deliveryTime: string) => {
  const match = deliveryTime.match(/(\d+)/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
};

const searchableDishText = (d: SpecialDish) =>
  [d.dishName, d.restaurant, d.description, d.cuisine].join(' ').toLowerCase();

function makeDishPredicate(dietFilter: DietFilter) {
  return (d: SpecialDish, query: string, activeFilterIds: string[]) => {
    const q = query.trim().toLowerCase();
    if (q && !searchableDishText(d).includes(q)) return false;
    // Only exclude a known slow delivery; server rows carry no prep time, so an unknown
    // time must pass rather than silently drop every remote result from the Fast chip.
    if (activeFilterIds.includes('fast') && d.deliveryTime && minutesOf(d.deliveryTime) > 30) return false;
    if (activeFilterIds.includes('veg') && !d.isVeg) return false;
    if (activeFilterIds.includes('rated') && (d.rating ?? 0) < 4.0) return false;
    if (!dishMatches(dietFilter, d)) return false;
    return true;
  };
}

/**
 * Food sub-app search wiring for the shared SearchScreen. Dishes-only: the
 * single "Dishes" mode renders the spec dish cards with veg indicator, rating
 * and an ADD-to-cart stepper. The toggle rail is hidden.
 */
export function createFoodSearchConfig({
  onDishPress,
  dietFilter = 'all',
}: FoodSearchOptions): SearchScreenConfig {
  const dishPredicate = makeDishPredicate(dietFilter);
  return {
    searchPlaceholder: 'Search dishes or cuisines…',
    accentColor: '#FF4500',
    toggles: [{ key: 'dishes', label: 'Dishes', icon: Soup }],
    showToggles: false,
    filterChips: [
      { id: 'fast', label: 'Fast Delivery', icon: Zap },
      { id: 'veg', label: 'Veg', icon: Leaf },
      { id: 'rated', label: 'Rated 4+', icon: Star },
    ],
    sortOptions: [
      { id: 'relevance', label: 'Relevance' },
      { id: 'rating', label: 'Rating' },
      { id: 'time', label: 'Delivery Time' },
      { id: 'cost-low', label: 'Cost: Low to High' },
      { id: 'cost-high', label: 'Cost: High to Low' },
    ],
    modes: {
      dishes: {
        key: 'dishes',
        data: TODAYS_SPECIALS,
        predicate: dishPredicate,
        renderCard: (item) => (
          <SearchDishCard dish={item as SpecialDish} onPress={onDishPress} />
        ),
        // Server FTS result pool (catalog, app=FOOD) with any approved festival discount overlaid;
        // the local `@data` specials pool is the offline/error fallback (Mart/Pharma pattern).
        fetch: async (q) =>
          (await withActiveDiscounts(await gateway.searchProducts(q, 'FOOD'))).map(viewToDish),
        sorters: {
          relevance: () => 0,
          rating: (a, b) => (b.rating ?? 0) - (a.rating ?? 0),
          time: (a, b) => minutesOf(a.deliveryTime ?? '') - minutesOf(b.deliveryTime ?? ''),
          'cost-low': (a, b) => a.price - b.price,
          'cost-high': (a, b) => b.price - a.price,
        },
      },
    },
    keyFor: (item) => String((item as { id?: string })?.id),
  };
}
