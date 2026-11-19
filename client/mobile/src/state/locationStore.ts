import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { Coordinates, ReverseGeocodeResult } from '@/services/location';

/**
 * The user's live (foreground-only) location. One store owns the fix so every
 * feed — Mart, Food, Pharma, search, categories — sorts from the same origin.
 *
 * The last coordinate, permission flag and the human-readable address label
 * are persisted (device-local, no reverse-geocode payload). This keeps the
 * header/checkout address honest across restarts instead of resetting to a
 * hardcoded string. Coordinates are never logged.
 *
 * `status` is the single source of truth for "is there a usable origin":
 * - `idle` — never asked / no fix yet (onboarding location step owns this).
 * - `loading` — a first fix is in flight.
 * - `ready` — a usable origin exists (GPS or manually picked).
 * - `denied` — permission refused; the OS may still prompt later.
 * - `blocked` — permission will not be prompted again (iOS denial or Android
 *   "don't ask again"), or Location Services is off at the OS level. Recovery is
 *   the Settings app; a manual address remains a valid origin.
 *
 * `source` distinguishes a GPS fix from a manually picked/saved address so a
 * permission re-check can never wipe a manual origin the user deliberately set.
 */
export type LocationStatus = 'idle' | 'loading' | 'ready' | 'denied' | 'blocked';
export type LocationSource = 'gps' | 'manual';

interface PersistedLocation {
  latitude: number;
  longitude: number;
  updatedAt: number;
  permissionGranted: boolean;
  address?: string;
  status?: LocationStatus;
  source?: LocationSource;
}

export interface LocationState {
  status: LocationStatus;
  /** Where the current fix came from; `null` until the first fix. */
  source: LocationSource | null;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  address: string;
  place: ReverseGeocodeResult | null;
  updatedAt: number | null;
  permissionGranted: boolean;
  /** OS Location Services master switch (false when the device has location off). */
  servicesEnabled: boolean;
  hydrated: boolean;
  setLoading: () => void;
  setFix: (fix: {
    coordinates: Coordinates;
    accuracy?: number | null;
    place?: ReverseGeocodeResult | null;
    address?: string;
    /** Defaults to `gps`; manual/saved addresses must pass `manual`. */
    source?: LocationSource;
  }) => void;
  /**
   * Update the permission view from a native re-check without fabricating a fix.
   * Called on resume so granting permission in OS Settings is picked up live.
   */
  setPermissionStatus: (
    status: LocationStatus,
    granted: boolean,
    servicesEnabled?: boolean,
  ) => void;
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

/** Persist the meaningful part of the current state (never a transient `loading`). */
function persistState(state: LocationState): void {
  if (state.status === 'idle' || state.status === 'loading') return;
  persist({
    latitude: state.latitude,
    longitude: state.longitude,
    updatedAt: state.updatedAt ?? Date.now(),
    permissionGranted: state.permissionGranted,
    address: state.address || undefined,
    status: state.status,
    source: state.source ?? undefined,
  });
}

function hasFix(state: Pick<LocationState, 'latitude' | 'longitude'>): boolean {
  return state.latitude !== 0 || state.longitude !== 0;
}

export const useLocationStore = create<LocationState>()((set, get) => ({
  status: 'idle',
  source: null,
  latitude: 0,
  longitude: 0,
  accuracy: null,
  address: '',
  place: null,
  updatedAt: null,
  permissionGranted: false,
  servicesEnabled: true,
  hydrated: false,

  setLoading: () => {
    if (get().status !== 'ready') set({ status: 'loading' });
  },

  setFix: ({ coordinates, accuracy, place, address, source = 'gps' }) => {
    const now = Date.now();
    const previous = get();
    const nextAddress = address ?? previous.address;
    // A manual fix is not a permission grant: it must not start the GPS poll.
    const permissionGranted =
      source === 'gps' ? true : previous.permissionGranted;
    set({
      status: 'ready',
      source,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      accuracy: accuracy ?? null,
      place: place ?? previous.place,
      address: nextAddress,
      updatedAt: now,
      permissionGranted,
    });
    persist({
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      updatedAt: now,
      permissionGranted,
      address: nextAddress || undefined,
      status: 'ready',
      source,
    });
  },

  setPermissionStatus: (status, granted, servicesEnabled) => {
    const state = get();
    // A manually chosen address stays a valid origin even when GPS is denied —
    // the nearby feeds must keep sorting from it.
    const keepManualOrigin =
      state.source === 'manual' && state.status === 'ready' && hasFix(state);

    if (granted) {
      set({
        // Never fabricate a fix: only an existing fix (GPS or manual) keeps `ready`.
        status:
          state.status === 'ready' ||
          (state.source === 'manual' && hasFix(state))
            ? 'ready'
            : 'idle',
        permissionGranted: true,
        servicesEnabled: servicesEnabled ?? state.servicesEnabled,
      });
    } else {
      set({
        status: keepManualOrigin
          ? 'ready'
          : status === 'blocked'
            ? 'blocked'
            : 'denied',
        permissionGranted: false,
        servicesEnabled: servicesEnabled ?? state.servicesEnabled,
      });
    }
    persistState(get());
  },

  setDenied: () => {
    get().setPermissionStatus('denied', false);
  },

  reset: () => {
    set({
      status: 'idle',
      source: null,
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
          const source: LocationSource =
            saved.source === 'manual' ? 'manual' : 'gps';
          const coordinatesKnown = saved.latitude !== 0 || saved.longitude !== 0;
          // Persisted permission state is only a hint: the native re-check on
          // resume is the truth. A manual origin stays usable regardless.
          let status: LocationStatus;
          if (saved.permissionGranted) {
            status = 'ready';
          } else if (source === 'manual' && coordinatesKnown) {
            status = 'ready';
          } else if (saved.status === 'blocked') {
            status = 'blocked';
          } else if (saved.status === 'denied') {
            status = 'denied';
          } else {
            status = 'idle';
          }
          set({
            status,
            source,
            latitude: saved.latitude,
            longitude: saved.longitude,
            address: typeof saved.address === 'string' ? saved.address : '',
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

/** Live origin for sorting; null until the first usable fix. */
export function selectOrigin(
  state: LocationState,
): Coordinates | null {
  // (0, 0) is the "no fix yet" sentinel; a single legitimate zero axis must still count.
  return state.status === 'ready' &&
    !(state.latitude === 0 && state.longitude === 0)
    ? { latitude: state.latitude, longitude: state.longitude }
    : null;
}
