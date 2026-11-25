import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { Coordinates, ReverseGeocodeResult } from '@/services/location';

/**
 * The user's location. Two separate facts live here, deliberately:
 *
 * - `deviceFix` — what the hardware says. Written ONLY by a real GPS read. It keeps updating while
 *   the app is foregrounded even after the user picks another address, because the checkout
 *   guardrail ("you're in Lalgudi but delivering to Chennai") needs the truth about where the phone
 *   is, not where the order is going.
 * - `activeLocation` — where the order is going and which feeds are sorted from. It is what every
 *   screen reads. It starts as the device fix, can be replaced by a saved address or a dropped pin,
 *   and is the ONLY thing sent to the gateway as the delivery origin.
 *
 * Collapsing these into one field (as this store used to) makes two real flows impossible: ordering
 * to a saved address in another city, and warning the user that they are nowhere near it.
 *
 * `overrideActive` records that the user chose deliberately. While it is set, proximity auto-select
 * stands down — otherwise a GPS drift of a few metres would keep yanking the origin back and fight
 * the choice the user just made.
 *
 * `status` is the single source of truth for "is there a usable origin":
 * - `idle` — never asked / no fix yet (onboarding location step owns this).
 * - `loading` — a first fix is in flight.
 * - `ready` — a usable `activeLocation` exists (device, saved, or pinned).
 * - `denied` — permission refused; the OS may still prompt later.
 * - `blocked` — permission will not be prompted again (iOS denial or Android
 *   "don't ask again"), or Location Services is off at the OS level. Recovery is
 *   the Settings app; a saved/pinned origin remains valid.
 */
export type LocationStatus = 'idle' | 'loading' | 'ready' | 'denied' | 'blocked';

/** Where the active origin came from. */
export type ActiveSource = 'gps' | 'saved' | 'pinned';

/** The hardware position. Never written from a typed address or a stored point. */
export interface DeviceFix {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  /** Reverse-geocoded label for the device position (may be empty when geocoding is unavailable). */
  address: string;
  place: ReverseGeocodeResult | null;
  updatedAt: number;
}

/** Where the order is going / which origin the feeds sort from. */
export interface ActiveLocation {
  latitude: number;
  longitude: number;
  address: string;
  /**
   * Reverse-geocoded fields for this origin (postalCode/district/region), when the caller could
   * resolve them. Used to report the customer's pincode to the gateway; never invented.
   */
  place?: ReverseGeocodeResult | null;
  /** Server id of the saved address this came from; absent for `gps` / `pinned`. */
  addressId?: string;
  source: ActiveSource;
  updatedAt: number;
}

interface PersistedLocation {
  deviceFix: DeviceFix | null;
  activeLocation: ActiveLocation | null;
  overrideActive: boolean;
  permissionGranted: boolean;
  status?: LocationStatus;
}

export interface LocationState {
  status: LocationStatus;
  deviceFix: DeviceFix | null;
  activeLocation: ActiveLocation | null;
  /**
   * True once the user explicitly chose a saved address or a dropped pin. Proximity auto-select
   * never overrides a deliberate choice; it is cleared when the user asks for their current location.
   */
  overrideActive: boolean;
  permissionGranted: boolean;
  /** OS Location Services master switch (false when the device has location off). */
  servicesEnabled: boolean;
  hydrated: boolean;
  /**
   * When the first silent fix attempt of this app session settled — success, permission refusal or a
   * GPS timeout. Session-only and never persisted: the app-level coverage gate holds the cold-start
   * splash until this is set, so a persisted origin from a previous run cannot decide coverage for a
   * user who has since moved. Kept at the first attempt so the poll does not keep re-arming it.
   */
  fixAttemptedAt: number | null;
  markFixAttempt: () => void;
  setLoading: () => void;
  /** Record a hardware position. Does not touch `activeLocation` — see `adoptDeviceAsActive`. */
  setDeviceFix: (fix: {
    coordinates: Coordinates;
    accuracy?: number | null;
    place?: ReverseGeocodeResult | null;
    address?: string;
  }) => void;
  /**
   * Make the device position the origin ("use my current location"). Clears any override so the
   * origin follows the user again.
   */
  adoptDeviceAsActive: () => void;
  /** Make an explicitly chosen origin (saved address / dropped pin) the origin. Sets the override. */
  setActiveLocation: (choice: {
    coordinates: Coordinates;
    address: string;
    source: ActiveSource;
    addressId?: string;
    place?: ReverseGeocodeResult | null;
  }) => void;
  /**
   * Proximity auto-select: when the user has NOT overridden, follow the device position, preferring
   * a saved address it is standing in. `candidate` is resolved by the caller (it owns the saved
   * list). Passing `null` means "no saved address nearby".
   */
  syncActiveToDevice: (candidate?: {
    addressId: string;
    coordinates: Coordinates;
    address: string;
  } | null) => void;
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

const STORAGE_KEY = 'faazio:location:v2';

export function formatPlace(place: ReverseGeocodeResult | null): string {
  if (!place) return '';
  return [place.street, place.district, place.city, place.region, place.postalCode]
    .filter(Boolean)
    .join(', ');
}

function persist(state: LocationState): void {
  if (state.status === 'idle' || state.status === 'loading') return;
  const payload: PersistedLocation = {
    deviceFix: state.deviceFix,
    activeLocation: state.activeLocation,
    overrideActive: state.overrideActive,
    permissionGranted: state.permissionGranted,
    status: state.status,
  };
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch(() => {});
}

/** A stored coordinate is only usable when both axes are present and not the (0,0) sentinel. */
function hasCoordinates(
  value: { latitude: number; longitude: number } | null | undefined,
): boolean {
  return Boolean(value && !(value.latitude === 0 && value.longitude === 0));
}

export const useLocationStore = create<LocationState>()((set, get) => ({
  status: 'idle',
  deviceFix: null,
  activeLocation: null,
  overrideActive: false,
  permissionGranted: false,
  servicesEnabled: true,
  hydrated: false,
  fixAttemptedAt: null,

  markFixAttempt: () => {
    if (get().fixAttemptedAt !== null) return;
    set({ fixAttemptedAt: Date.now() });
  },

  setLoading: () => {
    if (get().status !== 'ready') set({ status: 'loading' });
  },

  setDeviceFix: ({ coordinates, accuracy, place, address }) => {
    const now = Date.now();
    const previous = get();
    set({
      deviceFix: {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        accuracy: accuracy ?? null,
        address: address ?? previous.deviceFix?.address ?? '',
        place: place ?? previous.deviceFix?.place ?? null,
        updatedAt: now,
      },
      // A GPS read is proof the permission is granted; a manual choice is not.
      permissionGranted: true,
    });
    persist(get());
  },

  adoptDeviceAsActive: () => {
    const { deviceFix } = get();
    if (!deviceFix) return;
    set({
      status: 'ready',
      overrideActive: false,
      activeLocation: {
        latitude: deviceFix.latitude,
        longitude: deviceFix.longitude,
        address: deviceFix.address,
        place: deviceFix.place,
        source: 'gps',
        updatedAt: Date.now(),
      },
    });
    persist(get());
  },

  setActiveLocation: ({ coordinates, address, source, addressId, place }) => {
    set({
      status: 'ready',
      overrideActive: true,
      activeLocation: {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        address,
        place: place ?? null,
        source,
        ...(addressId ? { addressId } : {}),
        updatedAt: Date.now(),
      },
    });
    persist(get());
  },

  syncActiveToDevice: (candidate) => {
    const state = get();
    if (state.overrideActive) return;

    // Prefer a saved address the user is standing in — this is what makes "open the app at home and
    // it already says Home" work without a tap.
    if (candidate) {
      const current = state.activeLocation;
      const same =
        current?.source === 'saved' &&
        current.addressId === candidate.addressId &&
        current.latitude === candidate.coordinates.latitude &&
        current.longitude === candidate.coordinates.longitude;
      if (same) return;
      set({
        status: 'ready',
        activeLocation: {
          latitude: candidate.coordinates.latitude,
          longitude: candidate.coordinates.longitude,
          address: candidate.address,
          // The user is standing in the saved address; the device geocode is a safe pincode source.
          place: state.deviceFix?.place ?? null,
          addressId: candidate.addressId,
          source: 'saved',
          updatedAt: Date.now(),
        },
      });
      persist(get());
      return;
    }

    const device = state.deviceFix;
    if (!device) return;
    // Already following the device and it has not moved meaningfully: nothing to do.
    const current = state.activeLocation;
    if (
      current?.source === 'gps' &&
      current.latitude === device.latitude &&
      current.longitude === device.longitude &&
      current.address === device.address
    ) {
      return;
    }
    set({
      status: 'ready',
      activeLocation: {
        latitude: device.latitude,
        longitude: device.longitude,
        address: device.address,
        place: device.place,
        source: 'gps',
        updatedAt: Date.now(),
      },
    });
    persist(get());
  },

  setPermissionStatus: (status, granted, servicesEnabled) => {
    const state = get();
    // A deliberately chosen origin (saved address / pin) stays valid even when GPS is denied —
    // the nearby feeds must keep sorting from it.
    const keepChosenOrigin =
      state.overrideActive && state.status === 'ready' && hasCoordinates(state.activeLocation);

    if (granted) {
      set({
        // Never fabricate a fix: only an existing origin keeps `ready`.
        status:
          state.status === 'ready' || keepChosenOrigin ? 'ready' : 'idle',
        permissionGranted: true,
        servicesEnabled: servicesEnabled ?? state.servicesEnabled,
      });
    } else {
      set({
        status: keepChosenOrigin
          ? 'ready'
          : status === 'blocked'
            ? 'blocked'
            : 'denied',
        permissionGranted: false,
        servicesEnabled: servicesEnabled ?? state.servicesEnabled,
      });
    }
    persist(get());
  },

  setDenied: () => {
    get().setPermissionStatus('denied', false);
  },

  reset: () => {
    set({
      status: 'idle',
      deviceFix: null,
      activeLocation: null,
      overrideActive: false,
      permissionGranted: false,
      fixAttemptedAt: null,
    });
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  },

  hydrate: async () => {
    if (get().hydrated) return;
    const startedAt = Date.now();
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<PersistedLocation>;
        const deviceFix =
          saved.deviceFix && hasCoordinates(saved.deviceFix) ? saved.deviceFix : null;
        const activeLocation =
          saved.activeLocation && hasCoordinates(saved.activeLocation)
            ? saved.activeLocation
            : null;
        const overrideActive = Boolean(saved.overrideActive) && Boolean(activeLocation);

        // A live fix can land while this storage read is in flight (the mount-time silent refresh
        // races hydration). The live fix is the truth about where the device is now — a persisted
        // origin from a previous run must never overwrite it, or a user who moved into (or out of)
        // a covered district would keep yesterday's coverage decision.
        const live = get();
        const liveFixWon = Boolean(live.deviceFix && live.deviceFix.updatedAt >= startedAt);

        // Persisted permission state is only a hint: the native re-check on resume is the truth.
        // A chosen origin stays usable regardless.
        let status: LocationStatus;
        if (saved.permissionGranted && activeLocation) {
          status = 'ready';
        } else if (overrideActive) {
          status = 'ready';
        } else if (saved.status === 'blocked') {
          status = 'blocked';
        } else if (saved.status === 'denied') {
          status = 'denied';
        } else {
          status = 'idle';
        }

        if (liveFixWon) {
          // Keep the live fix/origin/permission; only adopt a deliberate override that the live
          // path has not already applied.
          set({
            status: live.status,
            deviceFix: live.deviceFix,
            activeLocation: live.activeLocation,
            overrideActive: live.overrideActive,
            permissionGranted: live.permissionGranted,
          });
        } else {
          set({
            status,
            deviceFix,
            activeLocation,
            overrideActive,
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

/** The origin every feed sorts from and checkout delivers to; null until one exists. */
export function selectOrigin(state: LocationState): Coordinates | null {
  const active = state.activeLocation;
  if (state.status !== 'ready' || !hasCoordinates(active)) return null;
  return { latitude: active!.latitude, longitude: active!.longitude };
}

/** The hardware position, regardless of what the user picked as the origin. */
export function selectDeviceFix(state: LocationState): Coordinates | null {
  return hasCoordinates(state.deviceFix)
    ? { latitude: state.deviceFix!.latitude, longitude: state.deviceFix!.longitude }
    : null;
}
