import { useCartStore } from '@/state/cartStore';
import type { Product } from '@data/types';

/**
 * Turn a Product into cart actions (quantity, add, +/− stepper). Kept in
 * shared/ so any card (search results, catalog grids, favourites) can wire
 * add-to-cart without duplicating the store plumbing.
 */
export function useCartProductActions(product: Product) {
  const cart = useCartStore((s) => s.cart);
  const addToCart = useCartStore((s) => s.addToCart);
  const updateQuantity = useCartStore((s) => s.updateQuantity);

  const quantity = cart.find((i) => i.id === product.id)?.quantity ?? 0;

  return {
    quantity,
    isAdded: quantity > 0,
    onAdd: () => addToCart(product.id, product.name, product.price, product.emoji),
    onIncrement: () => updateQuantity(product.id, 1),
    onDecrement: () => updateQuantity(product.id, -1),
  };
}
