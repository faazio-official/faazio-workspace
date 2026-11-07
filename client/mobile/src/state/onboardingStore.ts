import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

/**
 * Whether the first-run onboarding carousel has been completed or skipped.
 * A logged-out returning user should land on Login, not the carousel again.
 */
const STORAGE_KEY = 'faazio:onboarding:seen';

interface OnboardingState {
  hasSeenOnboarding: boolean;
  hydrated: boolean;
  markSeen: () => void;
  hydrate: () => Promise<void>;
}

export const useOnboardingStore = create<OnboardingState>()((set) => ({
  hasSeenOnboarding: false,
  hydrated: false,
  markSeen: () => {
    set({ hasSeenOnboarding: true });
    AsyncStorage.setItem(STORAGE_KEY, '1').catch(() => {});
  },
  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored === '1') set({ hasSeenOnboarding: true });
    } catch {
      // Corrupt cache is non-fatal; the carousel simply shows once more.
    } finally {
      set({ hydrated: true });
    }
  },
}));
