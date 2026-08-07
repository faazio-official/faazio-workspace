import { TOP_RATED_RESTAURANTS, DINING_RESTAURANTS } from '../mocks/restaurants';
import { TODAYS_SPECIALS } from '../mocks/specials';
import {
  QUICK_CATEGORIES,
  POPULAR_DINING_SPOTS,
  TOP_FOODS_TO_ORDER,
  NEARBY_RESTAURANTS,
} from '../mocks/homeFeed';
import type {
  QuickCategory,
  FoodType,
  NearbyRestaurant,
} from '../mocks/homeFeed';
import type { DiningRestaurant, SpecialDish } from '../mocks/types';

export interface DiningFeed {
  topRated: DiningRestaurant[];
  specials: SpecialDish[];
  dining: DiningRestaurant[];
  categories: QuickCategory[];
  popularSpots: DiningRestaurant[];
  topFoods: FoodType[];
  nearby: NearbyRestaurant[];
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Simulated network boundary. Once the Go Chi backend (server/) lands, replace
 * the internals with an API client while keeping the `DiningFeed` shape intact.
 */
export async function fetchDiningFeed(): Promise<DiningFeed> {
  await delay(700);
  return {
    topRated: TOP_RATED_RESTAURANTS,
    specials: TODAYS_SPECIALS,
    dining: DINING_RESTAURANTS,
    categories: QUICK_CATEGORIES,
    popularSpots: POPULAR_DINING_SPOTS,
    topFoods: TOP_FOODS_TO_ORDER,
    nearby: NEARBY_RESTAURANTS,
  };
}
