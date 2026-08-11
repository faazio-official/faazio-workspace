import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'faazio:recentSearches';
const MAX_RECENT = 10;

interface SearchState {
  recentSearches: string[];
  hydrated: boolean;
  addRecentSearch: (term: string) => void;
  removeRecentSearch: (term: string) => void;
  clearRecentSearches: () => void;
}

const persist = (terms: string[]) => {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(terms)).catch(() => {
    // Recent searches are best-effort device-local state; failures are silent.
  });
};

export const useSearchStore = create<SearchState>()((set) => ({
  recentSearches: [],
  hydrated: false,
  addRecentSearch: (term) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    set((state) => {
      const next = [trimmed, ...state.recentSearches.filter((t) => t !== trimmed)].slice(0, MAX_RECENT);
      persist(next);
      return { recentSearches: next };
    });
  },
  removeRecentSearch: (term) => {
    set((state) => {
      const next = state.recentSearches.filter((t) => t !== term);
      persist(next);
      return { recentSearches: next };
    });
  },
  clearRecentSearches: () => {
    set({ recentSearches: [] });
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  },
}));

AsyncStorage.getItem(STORAGE_KEY)
  .then((raw) => {
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((t) => typeof t === 'string')) {
      useSearchStore.setState({ recentSearches: parsed.slice(0, MAX_RECENT), hydrated: true });
    }
  })
  .catch(() => {});
