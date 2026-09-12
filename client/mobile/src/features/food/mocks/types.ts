export interface DiningRestaurant {
  id: string;
  name: string;
  image: string;
  rating: number;
  ratingCount: number;
  distance: number;
  deliveryTime: string;
  priceForTwo: number;
  cuisine: string;
  cuisines: string[];
  neighborhood: string;
  offerTag?: string;
  address: string;
  latitude: number;
  longitude: number;
  isFavourite: boolean;
  /** Zomato-style venue diet classification for the Veg / Non-Veg filter. */
  dietType: 'veg' | 'nonveg' | 'both';
}

import type { Product } from '@data/types';
import type { NearbyRestaurant } from './homeFeed';

/** Map a dining restaurant to a unified Product so its card can open the
 *  CommonProductDetail page. The restaurant is treated as a "premium dining"
 *  product using its per-two price as the unit price. */
export const restaurantToProduct = (spot: DiningRestaurant): Product => ({
  id: spot.id,
  app: 'FOOD',
  category: spot.cuisines[0] ?? spot.cuisine,
  name: spot.name,
  price: spot.priceForTwo,
  emoji: '🍽️',
  rating: spot.rating,
  desc: `${spot.cuisine} · ${spot.neighborhood} · ${spot.deliveryTime} delivery`,
  image: spot.image,
  shop: spot.name,
  attributes: { brand: spot.name, neighborhood: spot.neighborhood },
});

/** Adapt a compact "nearby" restaurant card into a full DiningRestaurant so its
 *  tap can open the shared RestaurantProfile page. The nearby model carries a
 *  subset of fields, so the missing ones (delivery time, neighborhood, review
 *  count) are derived deterministically. */
export const nearbyToRestaurant = (nearby: NearbyRestaurant): DiningRestaurant => ({
  id: nearby.id,
  name: nearby.name,
  image: nearby.image,
  rating: nearby.rating,
  ratingCount: 1200,
  distance: nearby.distance,
  deliveryTime: `${Math.max(15, Math.round(nearby.distance * 8))} min`,
  priceForTwo: nearby.priceForTwo,
  cuisine: nearby.cuisine,
  cuisines: nearby.cuisine.split(' • ').filter(Boolean),
  neighborhood: nearby.tags[0] ?? 'Local Favorite',
  address: `${nearby.name}, ${nearby.tags[0] ?? 'Downtown'}`,
  latitude: 0,
  longitude: 0,
  isFavourite: false,
  dietType: nearby.dietType,
});

export type { SpecialDish } from '@data/types';
