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

/**
 * The restaurant's menu, remote-first from `directory.menus`
 * (`GET /venues/{id}/menu`) through `GatewayClient.getMenu`, which already falls
 * back to the `@data/food/menus.ts` fixture on a network/HTTP error. The screen
 * still seeds from the fixture first so the list never flashes empty, then swaps
 * in the durable dishes once they arrive. An empty remote menu (a venue the
 * seller has not populated) keeps the seed so the profile is never blank.
 */
export function useRestaurantMenu(restaurant: DiningRestaurant): SpecialDish[] {
  const [menu, setMenu] = useState<SpecialDish[]>(() => getMenuForRestaurant(restaurant));

  useEffect(() => {
    let active = true;
    setMenu(getMenuForRestaurant(restaurant));
    gateway
      .getMenu(restaurant.id)
      .then((dishes) => {
        if (active && dishes.length > 0) {
          setMenu(dishes.map((d) => toSpecialDish(d, restaurant.name)));
        }
      })
      .catch(() => {
        // getMenu already falls back to the @data fixture internally.
      });
    return () => {
      active = false;
    };
  }, [restaurant.id, restaurant.name]);

  return menu;
}