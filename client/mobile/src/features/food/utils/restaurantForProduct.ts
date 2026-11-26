/**
 * Resolve a food product's restaurant when the caller already holds a server-backed store row.
 * There is **no** bundled restaurant/menu fixture: a FOOD product whose store never loads simply
 * has no tappable restaurant affordance (the server `GET /store/:id` path is the only source).
 */
import type { FoodRestaurant } from '../types';

/** Adapt a server `StoreProfile` (food store) into a `FoodRestaurant` (presentation-only fields
 *  that the server doesn't project default to neutral values). */
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
    priceForTwo: 0,
    cuisine: store.categories.join(' • '),
    cuisines: store.categories,
    neighborhood: store.address ?? '',
    offerTag: store.offerTag,
    address: store.address ?? '',
    latitude: store.latitude ?? 0,
    longitude: store.longitude ?? 0,
    isFavourite: false,
    dietType: store.isVeg === true ? 'veg' : store.isVeg === false ? 'nonveg' : 'both',
  };
}

