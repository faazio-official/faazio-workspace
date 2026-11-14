import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'faazio.delivery.settings';

interface PersistedSettings {
  vibrateOnOffer?: boolean;
}

interface DeliverySettingsState {
  hydrated: boolean;
  /** Haptic alert when a new offer lands while the app is open. */
  vibrateOnOffer: boolean;
  hydrate: () => Promise<void>;
  setVibrateOnOffer: (value: boolean) => Promise<void>;
}

/**
 * Delivery-partner local preferences. These are device preferences (not server
 * data), persisted with AsyncStorage, so the app keeps its single shared-state
 * home under `src/state/`. The Dashboard honours `vibrateOnOffer`.
 */
export const useDeliverySettingsStore = create<DeliverySettingsState>()((set) => ({
  hydrated: false,
  vibrateOnOffer: true,
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed: PersistedSettings = raw ? (JSON.parse(raw) as PersistedSettings) : {};
      set({
        vibrateOnOffer: parsed.vibrateOnOffer ?? true,
        hydrated: true,
      });
    } catch {
      set({ hydrated: true });
    }
  },
  setVibrateOnOffer: async (value) => {
    set({ vibrateOnOffer: value });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ vibrateOnOffer: value }));
    } catch {
      // Persisting a local preference failing is non-fatal; the in-memory value stays.
    }
  },
}));
