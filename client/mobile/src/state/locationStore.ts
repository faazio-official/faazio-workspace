import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { Coordinates, ReverseGeocodeResult } from '@/services/location';

/**
 * The user's live (foreground-only) location. One store owns the fix so every
 * feed — Mart, Food, Pharma, search, categories — sorts from the same origin.
 *
 * Only the last coordinate + permission flag are persisted (device-local, no
 * address/place fields). Address and accuracy stay in memory. Coordinates are
 * never logged.
 */
export type LocationStatus = 'idle' | 'loading' | 'ready' | 'denied';

interface PersistedLocation {
  latitude: number;
  longitude: number;
  updatedAt: number;
  permissionGranted: boolean;
}

export interface LocationState {
  status: LocationStatus;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  address: string;
  place: ReverseGeocodeResult | null;
  updatedAt: number | null;
  permissionGranted: boolean;
  hydrated: boolean;
  setLoading: () => void;
  setFix: (fix: {
    coordinates: Coordinates;
    accuracy?: number | null;
    place?: ReverseGeocodeResult | null;
    address?: string;
  }) => void;
  setDenied: () => void;
  reset: () => void;
  hydrate: () => Promise<void>;
}

const STORAGE_KEY = 'faazio:location:last';

export function formatPlace(place: ReverseGeocodeResult | null): string {
  if (!place) return '';
  return [place.street, place.district, place.city, place.region, place.postalCode]
    .filter(Boolean)
    .join(', ');
}

function persist(fix: PersistedLocation): void {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(fix)).catch(() => {});
}

export const useLocationStore = create<LocationState>()((set, get) => ({
  status: 'idle',
  latitude: 0,
  longitude: 0,
  accuracy: null,
  address: '',
  place: null,
  updatedAt: null,
  permissionGranted: false,
  hydrated: false,

  setLoading: () => {
    if (get().status !== 'ready') set({ status: 'loading' });
  },

  setFix: ({ coordinates, accuracy, place, address }) => {
    const now = Date.now();
    set({
      status: 'ready',
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      accuracy: accuracy ?? null,
      place: place ?? get().place,
      address: address ?? get().address,
      updatedAt: now,
      permissionGranted: true,
    });
    persist({
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      updatedAt: now,
      permissionGranted: true,
    });
  },

  setDenied: () => set({ status: 'denied', permissionGranted: false }),

  reset: () => {
    set({
      status: 'idle',
      latitude: 0,
      longitude: 0,
      accuracy: null,
      address: '',
      place: null,
      updatedAt: null,
      permissionGranted: false,
    });
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  },

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<PersistedLocation>;
        if (
          typeof saved.latitude === 'number' &&
          typeof saved.longitude === 'number'
        ) {
          set({
            status: saved.permissionGranted ? 'ready' : 'idle',
            latitude: saved.latitude,
            longitude: saved.longitude,
            updatedAt:
              typeof saved.updatedAt === 'number' ? saved.updatedAt : null,
            permissionGranted: Boolean(saved.permissionGranted),
          });
        }
      }
    } catch {
      // Corrupt cache is non-fatal: fall through to a fresh permission flow.
    } finally {
      set({ hydrated: true });
    }
  },
}));

/** Live origin for sorting; null until the first fix. */
export function selectOrigin(
  state: LocationState,
): Coordinates | null {
  return state.status === 'ready' && state.latitude !== 0
    ? { latitude: state.latitude, longitude: state.longitude }
    : null;
}
