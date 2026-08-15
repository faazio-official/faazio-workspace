import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const STORAGE_KEY = 'faazio:selectedLanguage';

interface LanguageState {
  language: string;
  hydrated: boolean;
  setLanguage: (id: string) => void;
  hydrate: () => Promise<void>;
}

export const useLanguageStore = create<LanguageState>()((set) => ({
  language: 'en',
  hydrated: false,
  setLanguage: (id) => {
    set({ language: id });
    AsyncStorage.setItem(STORAGE_KEY, id).catch(() => {});
  },
  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        set({ language: stored });
      }
    } finally {
      set({ hydrated: true });
    }
  },
}));
