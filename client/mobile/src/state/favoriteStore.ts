import { create } from 'zustand';
import { gateway } from '@/services/api/GatewayClient';

const SYNC_ERROR = 'Could not sync your favourites. Please try again.';

interface FavoriteState {
  favorites: string[];
  hydrated: boolean;
  syncing: boolean;
  syncError: string | null;
  /** Pull the durable shelf from the gateway (server is the source of truth). */
  hydrate: () => Promise<void>;
  toggleFavorite: (productId: string) => Promise<void>;
  reset: () => void;
}

/**
 * Server-authoritative favourites. `favourites.items` is the durable shelf; the local array is an
 * optimistic cache that rolls back when a server write fails. Mock/offline mode stays device-local
 * rather than fabricating a synced shelf.
 */
export const useFavoriteStore = create<FavoriteState>()((set, get) => ({
  favorites: [],
  hydrated: false,
  syncing: false,
  syncError: null,
  hydrate: async () => {
    if (!gateway.remoteEnabled) {
      set({ hydrated: true });
      return;
    }
    try {
      const favorites = await gateway.getFavourites();
      set({ favorites, hydrated: true, syncError: null });
    } catch {
      // Keep the current cache (stale-but-honest) and surface the failed refresh.
      set({ hydrated: true, syncError: 'Could not load your favourites.' });
    }
  },
  toggleFavorite: async (productId) => {
    const prev = get().favorites;
    const has = prev.includes(productId);
    set({
      favorites: has ? prev.filter((id) => id !== productId) : [...prev, productId],
      syncError: null,
    });

    if (!gateway.remoteEnabled) return;

    set({ syncing: true });
    try {
      const next = has
        ? await gateway.removeFavourite(productId)
        : await gateway.addFavourite(productId);
      set({ favorites: next, syncError: null });
    } catch {
      set({ favorites: prev, syncError: SYNC_ERROR });
    } finally {
      set({ syncing: false });
    }
  },
  reset: () => set({ favorites: [], hydrated: false, syncing: false, syncError: null }),
}));
