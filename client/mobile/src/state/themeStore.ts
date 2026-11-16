import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { DEFAULT_THEME_MODE, isThemeMode, type ThemeMode } from '@/theme/theme';

/**
 * Persisted appearance preference. Shared with the web surfaces via the same
 * `faazio.theme` key shape (web uses localStorage; mobile uses AsyncStorage).
 * Theme is not a secret, so it lives in AsyncStorage, not the Keychain.
 */
const STORAGE_KEY = 'faazio.theme';

interface ThemeState {
  themeMode: ThemeMode;
  hydrated: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  hydrate: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>()((set) => ({
  themeMode: DEFAULT_THEME_MODE,
  hydrated: false,
  setThemeMode: (mode) => {
    if (!isThemeMode(mode)) return;
    set({ themeMode: mode });
    AsyncStorage.setItem(STORAGE_KEY, mode).catch(() => {});
  },
  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (isThemeMode(stored)) {
        set({ themeMode: stored });
      }
    } catch {
      // Unreadable/corrupt storage is non-fatal: keep the light default.
    } finally {
      set({ hydrated: true });
    }
  },
}));
