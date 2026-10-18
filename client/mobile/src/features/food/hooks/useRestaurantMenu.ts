import { useEffect, useState } from 'react';
import type { SpecialDish } from '@data/types';
import { gateway, type MenuDish } from '@/services/api/GatewayClient';
import type { DiningRestaurant } from '../mocks/types';
import { getMenuForRestaurant } from '../utils/menu';

/** Map one durable `directory.menus` dish onto the app's `SpecialDish` card shape. */
function toSpecialDish(dish: MenuDish, restaurantName: string): SpecialDish {
  return {
    id: dish.id,
    dishName: dish.name,
    restaurant: restaurantName,
    price: dish.price,
    mrp: dish.mrp,
    image: dish.image ?? '',
    isVeg: dish.isVeg ?? true,
    description: dish.description ?? '',
    cuisine: dish.cuisine,
    rating: dish.rating,
    deliveryTime: dish.deliveryTime,
  };
}

export interface RestaurantMenuState {
  /** The venue's dishes — fixture seed first, then the durable remote list once it lands. */
  menu: SpecialDish[];
  /**
   * True while the remote menu is in flight **and** the fixture seed was empty. A seeded venue
   * paints instantly with no spinner; a server-only venue (no `@data` menu) shows a loading
   * state instead of flashing its honest "no dishes" empty state before the server replies.
   */
  loading: boolean;
}

/**
 * The restaurant's menu, remote-first from `directory.menus`
 * (`GET /venues/{id}/menu`) through the server-only `GatewayClient.fetchMenu`. The screen seeds
 * from the `@data/food/menus.ts` fixture first so a known venue paints instantly with no spinner,
 * then swaps in the durable dishes once the server replies — the server list is trusted as the
 * venue's own (no name re-filter, so a rename can't drop rows).
 *
 * The remote result is **authoritative**: a live `[]` (the seller has no public/ACTIVE dishes)
 * clears the seed and shows the honest empty menu, so a delisted venue never lingers as stale
 * fixture rows. Only a real failure (offline / HTTP error) keeps the seed, so the profile is
 * never blank offline.
 *
 * Festival discounts are deliberately NOT overlaid here: `promo.festival_optins` keys on
 * `catalog.products.product_id` and checkout never settles a discount for a `directory.menus` row, so a
 * menu-dish discount would be display-only (a price the cart can't honour). Discounted menu
 * dishes instead carry their own authored `mrp_paisa > price_paisa` strike (migration 0022).
 */
export function useRestaurantMenu(restaurant: DiningRestaurant): RestaurantMenuState {
  const [menu, setMenu] = useState<SpecialDish[]>(() => getMenuForRestaurant(restaurant));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const seed = getMenuForRestaurant(restaurant);
    setMenu(seed);
    // Only a server-only venue (empty seed) risks a false "no dishes" flash — a seeded venue
    // keeps its first-paint rows and never shows the spinner.
    setLoading(seed.length === 0);
    gateway
      .fetchMenu(restaurant.id)
      .then((dishes) => {
        if (!active) return;
        // Authoritative: an empty live list is the venue's real menu (seller emptied it).
        setMenu(dishes.map((d) => toSpecialDish(d, restaurant.name)));
      })
      .catch(() => {
        // Offline / HTTP error: keep the fixture seed so the profile is never blank.
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [restaurant.id, restaurant.name]);

  return { menu, loading };
}
