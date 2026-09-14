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

export type { SpecialDish } from '@data/types';
