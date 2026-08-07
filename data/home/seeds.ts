/**
 * @seed Bootstrap data hydrated into client state stores on first launch
 * (cart / favourites / location). See data/DATA_CONTROL.md.
 */
import type { CartItem } from '../types';

export const seedCartItems: CartItem[] = [
  { id: "cat-fm-1", name: "Spicy Tonkotsu Ramen", price: 225, quantity: 1, emoji: "🍜" },
];

export const seedFavorites: string[] = ['cat-fm-1', 'cat-gg-2', 'cat-mt-1'];

export const seedLocation: string = 'Sunnambukkara Street, Karaikal';
