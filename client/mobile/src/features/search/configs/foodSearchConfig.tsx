import React from 'react';
import { View, StyleSheet } from 'react-native';
import { UtensilsCrossed, Soup, Zap, Leaf, Star } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import type { DiningRestaurant, SpecialDish } from '@/features/food/mocks/types';
import { DINING_RESTAURANTS, TOP_RATED_RESTAURANTS } from '@/features/food/mocks/restaurants';
import { TODAYS_SPECIALS } from '@/features/food/mocks/specials';
import SearchRestaurantCard from '@/features/food/components/SearchRestaurantCard';
import type { SearchScreenConfig } from '../types';

interface FoodSearchOptions {
  onRestaurantPress?: (restaurant: DiningRestaurant) => void;
  onDishPress?: (dish: SpecialDish) => void;
}

const minutesOf = (deliveryTime: string) => {
  const match = deliveryTime.match(/(\d+)/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
};

const searchableText = (r: DiningRestaurant) =>
  [r.name, r.cuisine, ...r.cuisines, r.neighborhood].join(' ').toLowerCase();

function restaurantPredicate(r: DiningRestaurant, query: string, activeFilterIds: string[]) {
  const q = query.trim().toLowerCase();
  if (q && !searchableText(r).includes(q)) return false;
  if (activeFilterIds.includes('fast') && minutesOf(r.deliveryTime) > 30) return false;
  if (activeFilterIds.includes('veg') && !r.cuisines.some((c) => /veg/i.test(c))) return false;
  if (activeFilterIds.includes('rated') && r.rating < 4.0) return false;
  return true;
}

const mergedRestaurants: DiningRestaurant[] = [
  ...DINING_RESTAURANTS,
  ...TOP_RATED_RESTAURANTS.filter((r) => !DINING_RESTAURANTS.some((d) => d.id === r.id)),
];

/**
 * Food sub-app search wiring for the shared SearchScreen: "Restaurants" mode
 * renders the spec restaurant cards against the merged dining dataset; "Dishes"
 * mode is a placeholder until the dish card UI is specified.
 */
export function createFoodSearchConfig({
  onRestaurantPress,
  onDishPress,
}: FoodSearchOptions): SearchScreenConfig {
  return {
    title: 'Dining',
    searchPlaceholder: 'Search restaurants or cuisines…',
    accentColor: '#FF4500',
    toggles: [
      { key: 'restaurants', label: 'Restaurants', icon: UtensilsCrossed },
      { key: 'dishes', label: 'Dishes', icon: Soup },
    ],
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
      restaurants: {
        key: 'restaurants',
        data: mergedRestaurants,
        predicate: restaurantPredicate,
        renderCard: (item) => (
          <SearchRestaurantCard restaurant={item as DiningRestaurant} onPress={onRestaurantPress} />
        ),
        sorters: {
          relevance: () => 0,
          rating: (a, b) => b.rating - a.rating,
          time: (a, b) => minutesOf(a.deliveryTime) - minutesOf(b.deliveryTime),
          'cost-low': (a, b) => a.priceForTwo - b.priceForTwo,
          'cost-high': (a, b) => b.priceForTwo - a.priceForTwo,
        },
      },
      dishes: {
        key: 'dishes',
        data: TODAYS_SPECIALS,
        predicate: () => true,
        renderCard: () => null,
        sorters: {},
        empty: <DishPlaceholder onDishPress={onDishPress} />,
      },
    },
    keyFor: (item) => String((item as { id?: string })?.id),
  };
}

function DishPlaceholder({ onDishPress }: { onDishPress?: (dish: SpecialDish) => void }) {
  return (
    <View style={styles.dishWrap}>
      <View style={styles.dishCard}>
        <View style={styles.dishIconCircle}>
          <Soup size={ms(28)} color="#FF4500" strokeWidth={2} />
        </View>
        <AppText style={styles.dishTitle}>Dish search is on its way</AppText>
        <AppText style={styles.dishSub}>
          Dish-level cards and filters are being designed. You can still browse restaurants above.
        </AppText>
        <AppText style={styles.dishCount}>
          {TODAYS_SPECIALS.length} dishes currently in the catalog
        </AppText>
        {onDishPress ? (
          <AppText style={styles.dishSample} onPress={() => onDishPress(TODAYS_SPECIALS[0])}>
            Try a sample dish →
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dishWrap: {
    paddingHorizontal: hs(24),
    paddingVertical: vs(40),
  },
  dishCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: ms(16),
    borderWidth: 1,
    borderColor: '#F0F0F0',
    paddingHorizontal: hs(20),
    paddingVertical: vs(28),
    gap: vs(6),
  },
  dishIconCircle: {
    width: ms(56),
    height: ms(56),
    borderRadius: ms(28),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF450014',
    marginBottom: vs(6),
  },
  dishTitle: {
    fontSize: ms(15),
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  dishSub: {
    fontSize: ms(12),
    fontWeight: '400',
    color: '#666666',
    textAlign: 'center',
    lineHeight: ms(17),
  },
  dishCount: {
    fontSize: ms(11),
    fontWeight: '600',
    color: '#9CA3AF',
    marginTop: vs(4),
  },
  dishSample: {
    fontSize: ms(12),
    fontWeight: '700',
    color: '#FF4500',
    marginTop: vs(8),
  },
});
