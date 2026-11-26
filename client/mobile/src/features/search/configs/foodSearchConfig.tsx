import React from 'react';
import { Soup, Zap, Leaf, Star } from 'lucide-react-native';
import type { SpecialDish } from '@/features/food/types';
import { TODAYS_SPECIALS } from '@data/food/specials';
import { gateway } from '@/services/api/GatewayClient';
import { withActiveDiscounts } from '@/services/pricing';
import type { DietFilter } from '@/state/foodFilterStore';
import { dishMatches } from '@/features/food/utils/dietFilter';
import { productViewToDish } from '@/features/food/utils/productViewToDish';
import SearchDishCard from '@/features/food/components/SearchDishCard';
import type { SearchScreenConfig } from '../types';
import { brandRamp } from '@/theme/brandTokens';

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

// Tamil copy is searchable too: a shopper typing a Tamil dish name must match the translated row.
const searchableDishText = (d: SpecialDish) =>
  [d.dishName, d.dishNameTa, d.restaurant, d.description, d.descriptionTa, d.cuisine]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

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
    accentColor: brandRamp.FOOD.deep,
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
          (await withActiveDiscounts(await gateway.searchProducts(q, 'FOOD'))).map(productViewToDish),
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
