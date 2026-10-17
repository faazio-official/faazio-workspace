import type { SpecialDish } from '@data/types';
import { menuForVenueName } from '@data/food/menus';
import type { DiningRestaurant } from '../mocks/types';

/** The venue's own menu — the per-venue dining menu or the derived delivery-kitchen menu. Empty
 *  when the venue is unseeded: we show an honest empty menu rather than padding the shared specials
 *  with other restaurants' dishes (which would leak cross-venue content). */
export function getMenuForRestaurant(restaurant: DiningRestaurant): SpecialDish[] {
  return menuForVenueName(restaurant.name);
}

/** The venue's dishes that are actually on offer: an authored MRP above the selling price.
 *  This is the only content the "Recommended & Offers" rail / page may list — organic
 *  (undiscounted) dishes never sit under an offers title or an AD disclosure. */
export function getOfferDishes(dishes: SpecialDish[]): SpecialDish[] {
  return dishes.filter((d) => d.mrp !== undefined && d.mrp > d.price);
}

/** Distinct dish cuisines on a menu in first-seen order — the source of truth
 *  for the category chip rail (venue-level `restaurant.cuisines` carries labels
 *  no dish has, which renders dead chips). */
export function getMenuCategories(menu: SpecialDish[]): string[] {
  const seen = new Set<string>();
  for (const dish of menu) {
    const c = (dish.cuisine ?? '').trim();
    if (c) seen.add(c);
  }
  return [...seen];
}
