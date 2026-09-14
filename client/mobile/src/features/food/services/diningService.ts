import { TOP_RATED_RESTAURANTS, DINING_RESTAURANTS } from '../mocks/restaurants';
import { TODAYS_SPECIALS } from '../mocks/specials';
import { TOP_FOODS_TO_ORDER } from '../mocks/homeFeed';
import type { FoodType } from '../mocks/homeFeed';
import type { DiningRestaurant, SpecialDish } from '../mocks/types';

export interface DiningFeed {
  topRated: DiningRestaurant[];
  specials: SpecialDish[];
  dining: DiningRestaurant[];
  topFoods: FoodType[];
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
    topFoods: TOP_FOODS_TO_ORDER,
  };
}
