/**
 * Resolve a food product's restaurant as a full `FoodRestaurant` so the
 * unified product-detail page can deep-link into `RestaurantProfile`.
 *
 * Resolution order (mirrors `pickup-resolver.ts`):
 *   1. `product.storeId` → `foodStores` entry (adapted to `FoodRestaurant`).
 *   2. `product.shop` name matched against the food restaurant mock pools
 *      (`TOP_RATED_RESTAURANTS` + `FOOD_RESTAURANTS`) — richest data.
 *   3. `product.shop` name matched against `foodStores` (adapted).
 *   4. Otherwise `undefined` (no tappable restaurant affordance).
 */
import type { Product } from '@data/types';
import { foodStores } from '@data/food/stores';
import { TODAYS_SPECIALS } from '@data/food/specials';
import { TOP_RATED_RESTAURANTS, FOOD_RESTAURANTS } from '../mocks/restaurants';
import type { FoodRestaurant } from '../mocks/types';

const FOOD_RESTAURANT_MOCKS = [...TOP_RATED_RESTAURANTS, ...FOOD_RESTAURANTS];

/** Best-effort "price for two" from the store's own specials (fallback ₹500). */
function priceForTwoForStore(storeName: string): number {
  const dishes = TODAYS_SPECIALS.filter((d) => d.restaurant === storeName);
  if (dishes.length === 0) return 500;
  const avg = dishes.reduce((sum, d) => sum + d.price, 0) / dishes.length;
  return Math.max(200, Math.round(avg * 2));
}

/** Adapt a `StoreProfile` (food store) into a `FoodRestaurant`. */
export function storeProfileToFoodRestaurant(store: {
  id: string;
  name: string;
  categories: string[];
  rating: number;
  reviewsCount?: number;
  distance: string;
  distanceKm?: number;
  latitude?: number;
  longitude?: number;
  coverImage: string;
  offerTag?: string;
  address?: string;
  isVeg?: boolean;
}): FoodRestaurant {
  return {
    id: store.id,
    name: store.name,
    image: store.coverImage,
    rating: store.rating,
    ratingCount: store.reviewsCount ?? 0,
    distance: store.distanceKm ?? (parseFloat(store.distance) || 0),
    priceForTwo: priceForTwoForStore(store.name),
    cuisine: store.categories.join(' • '),
    cuisines: store.categories,
    neighborhood: 'Greenwood City',
    offerTag: store.offerTag,
    address: store.address ?? 'Greenwood City',
    latitude: store.latitude ?? 0,
    longitude: store.longitude ?? 0,
    isFavourite: false,
    dietType: store.isVeg === true ? 'veg' : store.isVeg === false ? 'nonveg' : 'both',
  };
}

/** Resolve a food product to a full `FoodRestaurant`, or `undefined`. */
export function getFoodRestaurantForProduct(
  product: Product,
): FoodRestaurant | undefined {
  if (product.app !== 'FOOD') return undefined;

  // 1. storeId → foodStores (adapt).
  if (product.storeId) {
    const store = foodStores.find((s) => s.id === product.storeId);
    if (store) return storeProfileToFoodRestaurant(store);
  }

  const shopName = product.shop?.trim().toLowerCase();
  if (!shopName) return undefined;

  // 2. shop name → food restaurant mock pools (richest data).
  const mock = FOOD_RESTAURANT_MOCKS.find(
    (r) => r.name.trim().toLowerCase() === shopName,
  );
  if (mock) return mock;

  // 3. shop name → foodStores (adapt).
  const byShop = foodStores.find(
    (s) => s.name.trim().toLowerCase() === shopName,
  );
  if (byShop) return storeProfileToFoodRestaurant(byShop);

  return undefined;
}
