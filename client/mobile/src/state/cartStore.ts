import { create } from 'zustand';
import { seedCartItems } from '@data/home/seeds';
import type { CartFulfilment } from '@data/types';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  emoji: string;
  originalPrice?: number;
  qtyDesc?: string;
  category?: 'MART' | 'FOOD' | 'PHARMA';
  fulfilment?: CartFulfilment;
}

export type CartCategory = 'MART' | 'FOOD' | 'PHARMA';

interface CartState {
  cart: CartItem[];
  addToCart: (
    id: string,
    name: string,
    price: number,
    emoji: string,
    opts?: { fulfilment?: CartFulfilment },
  ) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, delta: number) => void;
  clearCart: () => void;
  replaceCart: (items: CartItem[]) => void;
  totalQty: () => number;
}

export const useCartStore = create<CartState>()((set, get) => ({
  cart: [...seedCartItems],
  addToCart: (id, name, price, emoji, opts) => set((state) => {
    const existing = state.cart.find((i) => i.id === id);
    if (existing) {
      return {
        cart: state.cart.map((i) =>
          i.id === id ? { ...i, quantity: i.quantity + 1 } : i
        ),
      };
    }
    return { cart: [...state.cart, { id, name, price, quantity: 1, emoji, fulfilment: opts?.fulfilment }] };
  }),
  removeFromCart: (itemId) => set((state) => ({
    cart: state.cart.filter((i) => i.id !== itemId),
  })),
  updateQuantity: (itemId, delta) => set((state) => ({
    cart: state.cart
      .map((i) => (i.id === itemId ? { ...i, quantity: i.quantity + delta } : i))
      .filter((i) => i.quantity > 0),
  })),
  clearCart: () => set({ cart: [] }),
  replaceCart: (items) => set({ cart: items }),
  totalQty: () => get().cart.reduce((acc, curr) => acc + curr.quantity, 0),
}));
