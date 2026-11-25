import { create } from 'zustand';
import { useAuthStore } from '@/state/authStore';
import { useLocationStore } from '@/state/locationStore';
import { resolveServiceability } from '@/services/serviceability';

/**
 * The customer app's coverage decision for the current origin. The super admin controls coverage
 * through the partner portal district master (`admins.district_master.is_active`); this store
 * matches the on-device origin against that active list and exposes one settled status for the
 * app-level hard gate.
 *
 * - `unknown` — no authenticated origin yet, or the store was reset.
 * - `serviceable` — the origin matched an active district.
 * - `unserviceable` — the origin is outside coverage or in a district the super admin has not
 *   enabled.
 * - `failed` — coverage could not be read (offline/HTTP). Never mistaken for `unserviceable`, so a
 *   network failure cannot falsely lock a covered user out.
 *
 * `checking` is a separate flag, not a status: while a re-check is in flight the last settled
 * `unserviceable` result keeps the gate closed instead of flashing the shopping navigator.
 */
export type ServiceabilityStatus = 'unknown' | 'serviceable' | 'unserviceable' | 'failed';

export type ServiceabilityReason =
  | 'outside_coverage'
  | 'district_unavailable'
  | 'no_address'
  | 'network'
  | null;

export interface ServiceabilityState {
  status: ServiceabilityStatus;
  checking: boolean;
  stateCode: string | null;
  stateName: string | null;
  districtCode: string | null;
  districtName: string | null;
  reason: ServiceabilityReason;
  checkedAt: number | null;
  /** The origin this result belongs to (`lat,lng|address`) so a stale result is never shown. */
  locationKey: string | null;
  check: (force?: boolean) => Promise<ServiceabilityStatus>;
  reset: () => void;
}

function originKey(): string | null {
  const location = useLocationStore.getState();
  return originKeyFor(location);
}

/**
 * The origin key for a location snapshot. Exported so the app-level gate can derive "is this result
 * for the origin I am looking at" from reactive store slices instead of a non-reactive getState read.
 */
export function originKeyFor(location: {
  status: string;
  activeLocation: { latitude: number; longitude: number; address: string } | null;
}): string | null {
  const active = location.activeLocation;
  if (
    location.status !== 'ready' ||
    !active ||
    (active.latitude === 0 && active.longitude === 0)
  ) {
    return null;
  }
  return `${active.latitude.toFixed(4)},${active.longitude.toFixed(4)}|${active.address}`;
}

type InFlight = { key: string; promise: Promise<ServiceabilityStatus> };

let inFlight: InFlight | null = null;

const initial = {
  status: 'unknown' as ServiceabilityStatus,
  checking: false,
  stateCode: null,
  stateName: null,
  districtCode: null,
  districtName: null,
  reason: null as ServiceabilityReason,
  checkedAt: null,
  locationKey: null,
};

export const useServiceabilityStore = create<ServiceabilityState>()((set, get) => ({
  ...initial,

  check: async (force = false) => {
    if (!useAuthStore.getState().isAuthenticated) return 'unknown';
    const key = originKey();
    if (!key) return 'unknown';

    const current = get();
    const settled =
      current.status === 'serviceable' ||
      current.status === 'unserviceable' ||
      current.status === 'failed';
    if (!force && current.locationKey === key && settled) return current.status;
    if (inFlight?.key === key) return inFlight.promise;

    const location = useLocationStore.getState();
    set({ checking: true, locationKey: key });

    const promise = resolveServiceability({
      address: location.activeLocation?.address ?? '',
      // The chosen origin's own reverse geocode is the truth for a saved/pinned point. The device
      // fix is only the fallback for a live GPS origin that has not been geocoded yet — using it
      // first would decide coverage for a place the order is not going to.
      place: location.activeLocation?.place ?? location.deviceFix?.place ?? null,
      // The point the order goes to. Used only as a fallback when the geocode omits the district
      // name (a platform geocoder can return `adminDistrict: null` for a taluk), so it never
      // overrides a name match.
      origin: location.activeLocation
        ? {
            latitude: location.activeLocation.latitude,
            longitude: location.activeLocation.longitude,
          }
        : null,
      refreshCoverage: force,
    })
      .then((result): ServiceabilityStatus => {
        // The origin may have moved while the coverage read was in flight; its own check owns the
        // next result. Never paint a stale district over the new origin.
        if (originKey() !== key) return 'unknown';
        if (result.status === 'serviceable') {
          set({
            status: 'serviceable',
            checking: false,
            stateCode: result.match.stateCode,
            stateName: result.match.stateName,
            districtCode: result.match.districtCode,
            districtName: result.match.districtName,
            reason: null,
            checkedAt: Date.now(),
            locationKey: key,
          });
          return 'serviceable';
        }
        if (result.status === 'unknown') {
          set({
            status: 'failed',
            checking: false,
            reason: 'no_address',
            checkedAt: Date.now(),
            locationKey: key,
          });
          return 'failed';
        }
        set({
          status: 'unserviceable',
          checking: false,
          stateName: result.stateName ?? null,
          reason: result.reason,
          checkedAt: Date.now(),
          locationKey: key,
        });
        return 'unserviceable';
      })
      .catch((): ServiceabilityStatus => {
        if (originKey() !== key) return 'unknown';
        set({
          status: 'failed',
          checking: false,
          reason: 'network',
          checkedAt: Date.now(),
          locationKey: key,
        });
        return 'failed';
      })
      .finally(() => {
        if (inFlight?.promise === promise) inFlight = null;
      });

    inFlight = { key, promise };
    return promise;
  },

  reset: () => {
    inFlight = null;
    set({ ...initial });
  },
}));

export function selectServiceabilityBlocked(s: ServiceabilityState): boolean {
  return s.status === 'unserviceable';
}

/**
 * True while there is no settled decision for the *current* origin — either nothing has been read
 * yet, a read is in flight, or the settled result belongs to an origin the user has since left.
 * The app-level splash hold uses this so a result computed for a stale (persisted) origin never
 * decides the gate for the position the device just reported.
 */
export function isServiceabilityPending(
  s: Pick<ServiceabilityState, 'status' | 'checking' | 'locationKey'>,
  currentOriginKey: string | null,
): boolean {
  if (!currentOriginKey) return false;
  return s.status === 'unknown' || s.checking || s.locationKey !== currentOriginKey;
}
