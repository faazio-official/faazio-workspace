import { create } from 'zustand';
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

const SYNC_ERROR = 'Could not sync your cart. Please try again.';

interface CartState {
  cart: CartItem[];
  /** True once the durable cart has been pulled from the gateway (remote mode only). */
  hydrated: boolean;
  /** A server write is in flight. */
  syncing: boolean;
  /** Last failed write, cleared on the next successful one. */
  syncError: string | null;
  addToCart: (id: string, name: string, price: number, emoji: string, restaurantId?: string) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  updateQuantity: (itemId: string, delta: number) => Promise<void>;
  clearCart: () => Promise<void>;
  /** Remove only the lines owned by a restaurant (leaves common/other lines). */
  clearRestaurantCart: (restaurantId: string) => Promise<void>;
  replaceCart: (items: CartItem[]) => void;
  /** Pull the durable cart from the gateway and resolve product details (remote mode only). */
  hydrate: () => Promise<void>;
  /** Drop the device cache on sign-out without touching the server cart. */
  resetLocal: () => void;
  totalQty: () => number;
}

/**
 * Server-authoritative cart. The gateway (`inventory.carts`) is the source of truth; the local
 * array is an optimistic cache. Every mutation awaits the server write and rolls the UI back on
 * failure. In mock/offline mode (`remoteEnabled === false`) the store degrades to device-local state
 * instead of fabricating a successful server write.
 */
export const useCartStore = create<CartState>()((set, get) => ({
  cart: [],
  hydrated: false,
  syncing: false,
  syncError: null,

  addToCart: async (id, name, price, emoji, restaurantId) => {
    const prev = get().cart;
    const existing = prev.find((i) => i.id === id);
    const nextQty = (existing?.quantity ?? 0) + 1;
    const nextCart = existing
      ? prev.map((i) =>
          i.id === id
            ? {
                ...i,
                quantity: nextQty,
                // Adopt an untagged line into the restaurant that re-adds it.
                restaurantId: i.restaurantId ?? restaurantId,
              }
            : i,
        )
      : [...prev, { id, name, price, quantity: 1, emoji, restaurantId }];
    set({ cart: nextCart, syncError: null });

    if (!gateway.remoteEnabled) return;

    set({ syncing: true });
    try {
      // The gateway's POST/PUT both SET the absolute quantity (not increment), so an existing line
      // must send its next total — otherwise re-adding an item would reset it to 1.
      if (existing) await gateway.updateCartItem(id, nextQty);
      else await gateway.addToCart(id, 1);
      void gateway.trackEvent(id, 'cart_add').catch(() => {});
    } catch {
      set({ cart: prev, syncError: SYNC_ERROR });
    } finally {
      set({ syncing: false });
    }
  },

  removeFromCart: async (itemId) => {
    const prev = get().cart;
    if (!prev.some((i) => i.id === itemId)) return;
    set({ cart: prev.filter((i) => i.id !== itemId), syncError: null });

    if (!gateway.remoteEnabled) return;

    set({ syncing: true });
    try {
      await gateway.removeCartItem(itemId);
    } catch {
      set({ cart: prev, syncError: SYNC_ERROR });
    } finally {
      set({ syncing: false });
    }
  },

  updateQuantity: async (itemId, delta) => {
    const prev = get().cart;
    const current = prev.find((i) => i.id === itemId);
    if (!current) return;
    const nextQty = current.quantity + delta;
    const nextCart =
      nextQty > 0
        ? prev.map((i) => (i.id === itemId ? { ...i, quantity: nextQty } : i))
        : prev.filter((i) => i.id !== itemId);
    set({ cart: nextCart, syncError: null });

    if (!gateway.remoteEnabled) return;

    set({ syncing: true });
    try {
      if (nextQty > 0) await gateway.updateCartItem(itemId, nextQty);
      else await gateway.removeCartItem(itemId);
    } catch {
      set({ cart: prev, syncError: SYNC_ERROR });
    } finally {
      set({ syncing: false });
    }
  },

  clearCart: async () => {
    const prev = get().cart;
    if (prev.length === 0) return;
    const ids = prev.map((i) => i.id);
    set({ cart: [], syncError: null });

    if (!gateway.remoteEnabled) return;

    set({ syncing: true });
    try {
      const results = await Promise.allSettled(ids.map((id) => gateway.removeCartItem(id)));
      const failed = new Set(
        ids.filter((_, i) => results[i].status === 'rejected'),
      );
      if (failed.size > 0) {
        // Re-add only the lines the server refused to delete; successfully deleted lines stay gone.
        set({ cart: prev.filter((i) => failed.has(i.id)), syncError: SYNC_ERROR });
      }
    } finally {
      set({ syncing: false });
    }
  },

  clearRestaurantCart: async (restaurantId) => {
    const prev = get().cart;
    const ids = prev.filter((i) => i.restaurantId === restaurantId).map((i) => i.id);
    if (ids.length === 0) return;
    set({
      cart: prev.filter((i) => i.restaurantId !== restaurantId),
      syncError: null,
    });

    if (!gateway.remoteEnabled) return;

    set({ syncing: true });
    try {
      const results = await Promise.allSettled(ids.map((id) => gateway.removeCartItem(id)));
      const failed = new Set(
        ids.filter((_, i) => results[i].status === 'rejected'),
      );
      if (failed.size > 0) {
        set({
          cart: prev.filter((i) => i.restaurantId !== restaurantId || failed.has(i.id)),
          syncError: SYNC_ERROR,
        });
      }
    } finally {
      set({ syncing: false });
    }
  },

  replaceCart: (items) => set({ cart: items }),

  hydrate: async () => {
    if (!gateway.remoteEnabled) {
      set({ hydrated: true });
      return;
    }
    try {
      const remote = await gateway.getCart();
      if (!remote.items.length) {
        // A successful empty response is authoritative: never keep fixture/previous-user lines.
        set({ cart: [], hydrated: true, syncError: null });
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
      set({ cart: items, hydrated: true, syncError: null });
    } catch {
      // Keep the current cache (stale-but-honest) and surface the failed refresh.
      set({ hydrated: true, syncError: 'Could not load your cart.' });
    }
  },

  resetLocal: () =>
    set({ cart: [], hydrated: false, syncing: false, syncError: null }),

  totalQty: () => get().cart.reduce((acc, curr) => acc + curr.quantity, 0),
}));
