import type { SpecialDish } from '@data/types';
import { TODAYS_SPECIALS } from '@data/food/specials';
import { restaurantMenus } from '@data/food/menus';
import type { DiningRestaurant } from '../mocks/types';

/** Build the restaurant's menu from its per-restaurant menu first (so each dining
 *  room shows its own dishes), falling back to matching the shared specials
 *  catalog by cuisine and padding with the remaining dishes so every restaurant
 *  has a full menu. */
export function getMenuForRestaurant(restaurant: DiningRestaurant): SpecialDish[] {
  const own = restaurantMenus[restaurant.name];
  if (own && own.length > 0) return own;
  const cuisines = restaurant.cuisines.map((c) => c.toLowerCase());
  const matched = TODAYS_SPECIALS.filter((d) =>
    cuisines.some((c) => (d.cuisine ?? '').toLowerCase().includes(c) || c.includes((d.cuisine ?? '').toLowerCase())),
  );
  const rest = TODAYS_SPECIALS.filter((d) => !matched.includes(d));
  return [...matched, ...rest];
}

/** All dishes in the restaurant's menu that belong to the current restaurant —
 *  the only content the "Recommended & Offers" rail / page should show. */
export function getOwnDishes(menu: SpecialDish[], restaurantName: string): SpecialDish[] {
  return menu.filter((d) => d.restaurant === restaurantName);
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
