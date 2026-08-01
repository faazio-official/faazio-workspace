import { create } from 'zustand';
import { seedFavorites } from '@data/home/seeds';

interface FavoriteState {
  favorites: string[];
  toggleFavorite: (productId: string) => void;
}

export const useFavoriteStore = create<FavoriteState>()((set) => ({
  favorites: [...seedFavorites],
  toggleFavorite: (productId) => set((state) => ({
    favorites: state.favorites.includes(productId)
      ? state.favorites.filter((id) => id !== productId)
      : [...state.favorites, productId],
  })),
}));
