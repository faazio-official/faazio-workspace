import { create } from 'zustand';
import { seedCartItems } from '@data/home/seeds';
import { gateway } from '@/services/api/GatewayClient';

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
  /** True once the durable cart has been pulled from the gateway (remote mode only). */
  hydrated: boolean;
  addToCart: (id: string, name: string, price: number, emoji: string, restaurantId?: string) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, delta: number) => void;
  clearCart: () => void;
  /** Remove only the lines owned by a restaurant (leaves common/other lines). */
  clearRestaurantCart: (restaurantId: string) => void;
  replaceCart: (items: CartItem[]) => void;
  /** Pull the durable cart from the gateway and resolve product details (remote mode only). */
  hydrate: () => Promise<void>;
  totalQty: () => number;
}

/**
 * The cart is the optimistic UI model; the durable `inventory.carts` row is the server twin.
 * Every mutation updates local state first, then mirrors best-effort to the gateway (no-op in mock
 * mode). `hydrate()` pulls the server cart on session start and rejoins catalog details.
 */
export const useCartStore = create<CartState>()((set, get) => ({
  cart: [...seedCartItems],
  hydrated: false,

  addToCart: (id, name, price, emoji, restaurantId) => {
    set((state) => {
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
              : i,
          ),
        };
      }
      return { cart: [...state.cart, { id, name, price, quantity: 1, emoji, restaurantId }] };
    });
    void gateway.addToCart(id, 1).catch(() => {});
    void gateway.trackEvent(id, 'cart_add').catch(() => {});
  },

  removeFromCart: (itemId) => {
    set((state) => ({ cart: state.cart.filter((i) => i.id !== itemId) }));
    void gateway.removeCartItem(itemId).catch(() => {});
  },

  updateQuantity: (itemId, delta) => {
    const current = get().cart.find((i) => i.id === itemId);
    const nextQty = (current?.quantity ?? 1) + delta;
    set((state) => ({
      cart: state.cart
        .map((i) => (i.id === itemId ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0),
    }));
    // Best-effort server mirror: update when the line survives, else remove it.
    if (nextQty > 0) void gateway.updateCartItem(itemId, nextQty).catch(() => {});
    else void gateway.removeCartItem(itemId).catch(() => {});
  },

  clearCart: () => {
    const ids = get().cart.map((i) => i.id);
    set({ cart: [] });
    ids.forEach((id) => void gateway.removeCartItem(id).catch(() => {}));
  },

  clearRestaurantCart: (restaurantId) => {
    const ids = get()
      .cart.filter((i) => i.restaurantId === restaurantId)
      .map((i) => i.id);
    set((state) => ({ cart: state.cart.filter((i) => i.restaurantId !== restaurantId) }));
    ids.forEach((id) => void gateway.removeCartItem(id).catch(() => {}));
  },

  replaceCart: (items) => set({ cart: items }),

  hydrate: async () => {
    if (!gateway.remoteEnabled) return;
    const wasHydrated = get().hydrated;
    const remote = await gateway.getCart();
    // First remote hydrate with an empty server cart must clear the local `seedCartItems`, so the
    // shopper never sees or checks out fixture lines the server doesn't have. Later empty responses
    // (e.g. a transient blip) leave the current cart alone.
    if (!remote.items.length) {
      if (!wasHydrated) set({ cart: [], hydrated: true });
      return;
    }
    const products = await gateway.getProductsByIds(remote.items.map((i) => i.productId));
    const items: CartItem[] = remote.items.map((ci) => {
      const p = products.find((pp) => pp.id === ci.productId);
      return {
        id: ci.productId,
        name: p?.name ?? ci.productId,
        price: p?.price ?? 0,
        quantity: ci.qty,
        emoji: p?.emoji ?? '🛒',
        imageUrl: p?.image || undefined,
        originalPrice: p?.originalPrice,
        category: p?.app,
      };
    });
    set({ cart: items, hydrated: true });
  },

  totalQty: () => get().cart.reduce((acc, curr) => acc + curr.quantity, 0),
}));

// Pull the durable cart at store creation (fire-and-forget; no-op in mock mode).
useCartStore.getState().hydrate().catch(() => {});