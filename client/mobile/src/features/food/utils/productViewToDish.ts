import type { ProductView } from '@/services/api/GatewayClient';
import { getProductById } from '@data/catalog/products';
import type { SpecialDish } from '../types';

/**
 * Map a server catalog/FTS row (app=FOOD) onto the Food dish card shape. The catalog projection
 * drops `isVeg`, so it is recovered from the local `@data` fixture by id when known — a truly
 * server-only row keeps `undefined`, which the diet predicate treats as unclassified (hidden only
 * under an active Veg/Non-Veg filter, never mislabelled). Prices stay server-authoritative.
 */
export function productViewToDish(p: ProductView): SpecialDish {
  const local = getProductById(p.id);
  const dietary = p.attributes?.dietary;
  const isVeg =
    local?.isVeg !== undefined
      ? local.isVeg
      : dietary === 'Vegetarian'
        ? true
        : dietary === 'Non-Veg'
          ? false
          : undefined;
  const restaurant =
    (p.shop as string | undefined) ?? (p.attributes?.brand as string | undefined) ?? 'Faazio';
  return {
    id: p.id,
    dishName: p.name,
    ...(p.nameTa ? { dishNameTa: p.nameTa } : {}),
    ...(p.descTa ? { descriptionTa: p.descTa } : {}),
    restaurant,
    ...(p.storeId ? { restaurantId: p.storeId } : {}),
    price: p.price,
    mrp: p.originalPrice !== undefined && p.originalPrice > p.price ? p.originalPrice : undefined,
    image: p.image,
    isVeg: isVeg as boolean,
    description: p.desc,
    cuisine: p.category,
    rating: p.rating,
  };
}
