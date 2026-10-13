import { create } from 'zustand';
import { seedFavorites } from '@data/home/seeds';
import { gateway } from '@/services/api/GatewayClient';

interface FavoriteState {
  favorites: string[];
  hydrated: boolean;
  /** Pull the durable shelf from the gateway (falls back to the seed in mock mode). */
  hydrate: () => Promise<void>;
  toggleFavorite: (productId: string) => void;
  reset: () => void;
}

export const useFavoriteStore = create<FavoriteState>()((set, get) => ({
  favorites: [...seedFavorites],
  hydrated: false,
  hydrate: async () => {
    const favorites = await gateway.getFavourites();
    set({ favorites, hydrated: true });
  },
  toggleFavorite: (productId) => {
    const has = get().favorites.includes(productId);
    set((state) => ({
      favorites: has
        ? state.favorites.filter((id) => id !== productId)
        : [...state.favorites, productId],
    }));
    // Optimistic UI: the local shelf is authoritative; the server write is best-effort.
    const remote = has ? gateway.removeFavourite(productId) : gateway.addFavourite(productId);
    void remote.catch(() => {});
  },
  reset: () => set({ favorites: [], hydrated: false }),
}));

// Hydrate the durable shelf at store creation (fire-and-forget, bloodDonorStore-style).
useFavoriteStore.getState().hydrate().catch(() => {});