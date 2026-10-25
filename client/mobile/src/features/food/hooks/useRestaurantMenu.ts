import { useEffect, useState } from 'react';
import type { SpecialDish } from '@data/types';
import { gateway, type MenuDish } from '@/services/api/GatewayClient';
import type { DiningRestaurant } from '../mocks/types';

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
  /** The venue's durable dishes as served by the gateway (`[]` until loaded / offline). */
  menu: SpecialDish[];
  /** True while the remote menu is in flight, so an honest empty state is not flashed first. */
  loading: boolean;
}

/**
 * The restaurant's menu, server-only from `directory.menus` (`GET /venues/{id}/menu`) through
 * `GatewayClient.fetchMenu`. No `@data` fixture is substituted: a live `[]` is the venue's real
 * menu, and a failed/offline read shows an honest empty menu instead of mock dishes.
 *
 * Festival discounts are deliberately NOT overlaid here: `promo.festival_optins` keys on
 * `catalog.products.product_id` and checkout never settles a discount for a `directory.menus` row, so a
 * menu-dish discount would be display-only (a price the cart can't honour). Discounted menu
 * dishes instead carry their own authored `mrp_paisa > price_paisa` strike (migration 0022).
 */
export function useRestaurantMenu(restaurant: DiningRestaurant): RestaurantMenuState {
  const [menu, setMenu] = useState<SpecialDish[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setMenu([]);
    setLoading(true);
    gateway
      .fetchMenu(restaurant.id)
      .then((dishes) => {
        if (!active) return;
        // Authoritative: an empty live list is the venue's real menu (seller emptied it).
        setMenu(dishes.map((d) => toSpecialDish(d, restaurant.name)));
      })
      .catch(() => {
        // Offline / HTTP error: show the honest empty menu, never fixture dishes.
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
