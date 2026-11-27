import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

/**
 * Where a signed-out user stands in the mandatory sign-in funnel:
 * phone auth → location → app.
 *
 * Persisted so closing the app mid-funnel reopens at the step they left
 * (skip welcome → phone auth; skip phone auth → location; location confirmed → app).
 * An absent key means 'home': returning guests from before the funnel existed keep the
 * catalogue as their landing screen and are never trapped.
 */
const STORAGE_KEY = 'faazio:funnel:stage';

export type AuthFunnelStage = 'auth' | 'location' | 'home';

interface AuthFunnelState {
  stage: AuthFunnelStage;
  hydrated: boolean;
  setStage: (stage: AuthFunnelStage) => void;
  hydrate: () => Promise<void>;
}

export const useAuthFunnelStore = create<AuthFunnelState>()((set) => ({
  stage: 'home',
  hydrated: false,
  setStage: (stage) => {
    set({ stage });
    AsyncStorage.setItem(STORAGE_KEY, stage).catch(() => {});
  },
  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored === 'auth' || stored === 'location' || stored === 'home') {
        set({ stage: stored });
      }
    } catch {
      // Corrupt cache is non-fatal; the funnel simply restarts at phone auth.
    } finally {
      set({ hydrated: true });
    }
  },
}));
