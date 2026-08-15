import {
  GROCERY_TOP_PICKS,
  GROCERY_BEST_DEALS,
  GROCERY_SEASON_SPECIALS,
  GROCERY_TOP_BRANDS,
  GROCERY_ALSO_NEED,
  GROCERY_AD_BANNERS,
  type GroceryProductItem,
  type GroceryBestDeal,
  type GrocerySeasonSpecial,
  type GroceryTopBrand,
  type GroceryAdBanner,
} from '../mocks/groceryHomeFeed';

export interface GroceryFeed {
  topPicks: GroceryProductItem[];
  bestDeals: GroceryBestDeal[];
  seasonSpecials: GrocerySeasonSpecial[];
  topBrands: GroceryTopBrand[];
  alsoNeed: GroceryProductItem[];
  adBanners: GroceryAdBanner[];
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Simulated network boundary for the Grocery home feed. Once the Go Chi backend
 * (server/) lands, replace the internals with an API client while keeping the
 * `GroceryFeed` shape intact.
 */
export async function fetchGroceryFeed(): Promise<GroceryFeed> {
  await delay(700);
  return {
    topPicks: GROCERY_TOP_PICKS,
    bestDeals: GROCERY_BEST_DEALS,
    seasonSpecials: GROCERY_SEASON_SPECIALS,
    topBrands: GROCERY_TOP_BRANDS,
    alsoNeed: GROCERY_ALSO_NEED,
    adBanners: GROCERY_AD_BANNERS,
  };
}
