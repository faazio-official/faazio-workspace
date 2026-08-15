import { useRef, useEffect } from 'react';
import { Animated } from 'react-native';
import { useCartStore } from '@/state/cartStore';
import type { Product } from '@data/types';

export function usePulse(duration = 1200, minValue = 0.3) {
  const anim = useRef(new Animated.Value(1));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim.current, {
          toValue: minValue,
          duration: duration / 2,
          useNativeDriver: true,
        }),
        Animated.timing(anim.current, {
          toValue: 1,
          duration: duration / 2,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [duration, minValue]);

  return anim.current;
}

export function useSpringBounce(active = false) {
  const anim = useRef(new Animated.Value(active ? 1.3 : 1));

  useEffect(() => {
    Animated.spring(anim.current, {
      toValue: active ? 1.3 : 1,
      friction: 3,
      tension: 200,
      useNativeDriver: true,
    }).start();
  }, [active]);

  return anim.current;
}

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
