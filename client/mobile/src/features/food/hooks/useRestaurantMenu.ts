import { useEffect, useState } from 'react';
import type { SpecialDish } from '@data/types';
import { gateway, type MenuDish } from '@/services/api/GatewayClient';
import { effectivePrice, fetchActiveDiscounts } from '@/services/pricing';
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
 * Overlay one approved festival discount on a menu dish (server-capped, remote-only). Untouched
 * when there is no discount or it does not lower the price, so a full-price dish renders exactly as
 * before — the authored MRP is preserved as the strike when present, else the base price becomes it.
 */
function applyDishDiscount(dish: SpecialDish, discountPercent: number): SpecialDish {
  if (discountPercent <= 0) return dish;
  const price = effectivePrice(dish.price, discountPercent);
  if (price >= dish.price) return dish;
  const mrp = dish.mrp !== undefined && dish.mrp > dish.price ? dish.mrp : dish.price;
  return { ...dish, price, mrp };
}

/**
 * The restaurant's menu, remote-first from `directory.menus`
 * (`GET /venues/{id}/menu`) through `GatewayClient.getMenu`, which already falls
 * back to the `@data/food/menus.ts` fixture on a network/HTTP error. The screen
 * still seeds from the fixture first so the list never flashes empty, then swaps
 * in the durable dishes once they arrive — the server list is trusted as the
 * venue's own (no name re-filter, so a rename can't drop rows). An empty remote
 * menu (a venue the seller has not populated) keeps the seed so the profile is
 * never blank. Approved festival discounts are overlaid on the remote rows in the
 * same pass (the server is the discount authority; mock/offline leaves them off).
 */
export function useRestaurantMenu(restaurant: DiningRestaurant): SpecialDish[] {
  const [menu, setMenu] = useState<SpecialDish[]>(() => getMenuForRestaurant(restaurant));

  useEffect(() => {
    let active = true;
    setMenu(getMenuForRestaurant(restaurant));
    gateway
      .getMenu(restaurant.id)
      .then(async (dishes) => {
        if (!active || dishes.length === 0) return;
        const mapped = dishes.map((d) => toSpecialDish(d, restaurant.name));
        const discounts = await fetchActiveDiscounts(mapped.map((d) => d.id));
        if (!active) return;
        setMenu(mapped.map((d) => applyDishDiscount(d, discounts[d.id]?.discountPercent ?? 0)));
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
