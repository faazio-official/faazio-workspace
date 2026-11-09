export interface FoodRestaurant {
  id: string;
  name: string;
  image: string;
  rating: number;
  ratingCount: number;
  distance: number;
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

export interface FoodType {
  id: string;
  name: string;
  image: string;
  rating: number;
  dietType: 'veg' | 'nonveg' | 'both';
}

/** Compact "nearby" restaurant row model, also consumed by the Home hub. */
export interface NearbyRestaurant {
  id: string;
  name: string;
  image: string;
  cuisine: string;
  rating: number;
  distance: number;
  priceForTwo: number;
  tags: string[];
  dietType: 'veg' | 'nonveg' | 'both';
}

export interface SnackBeverage {
  id: string;
  name: string;
  image: string;
  isVeg?: boolean;
}

export type { SpecialDish } from '@data/types';
