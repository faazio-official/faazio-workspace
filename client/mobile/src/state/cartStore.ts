import { create } from 'zustand';
import { seedCartItems } from '@data/home/seeds';

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
  /**
   * Owning restaurant when this line was added from a restaurant page (profile
   * or its offers page). Untagged lines (search, product detail, Mart/Pharma,
   * seeds) belong to the common cart only. Enables the restaurant-isolated
   * cart view without a second store.
   */
  restaurantId?: string;
}

export type CartCategory = 'MART' | 'FOOD' | 'PHARMA';

interface CartState {
  cart: CartItem[];
  addToCart: (id: string, name: string, price: number, emoji: string, restaurantId?: string) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, delta: number) => void;
  clearCart: () => void;
  /** Remove only the lines owned by a restaurant (leaves common/other lines). */
  clearRestaurantCart: (restaurantId: string) => void;
  replaceCart: (items: CartItem[]) => void;
  totalQty: () => number;
}

export const useCartStore = create<CartState>()((set, get) => ({
  cart: [...seedCartItems],
  addToCart: (id, name, price, emoji, restaurantId) => set((state) => {
    const existing = state.cart.find((i) => i.id === id);
    if (existing) {
      return {
        cart: state.cart.map((i) =>
          i.id === id
            ? {
                ...i,
                quantity: i.quantity + 1,
                // Adopt an untagged line into the restaurant that re-adds it.
                restaurantId: i.restaurantId ?? restaurantId,
              }
            : i
        ),
      };
    }
    return { cart: [...state.cart, { id, name, price, quantity: 1, emoji, restaurantId }] };
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
  clearRestaurantCart: (restaurantId) => set((state) => ({
    cart: state.cart.filter((i) => i.restaurantId !== restaurantId),
  })),
  replaceCart: (items) => set({ cart: items }),
  totalQty: () => get().cart.reduce((acc, curr) => acc + curr.quantity, 0),
}));
