import { useEffect, useMemo } from 'react';
import { AppState } from 'react-native';
import {
  distanceMeters,
  getCoarsePosition,
  getHighAccuracyPosition,
  getLocationAuthorizationStatus,
  isLocationServicesEnabled,
  requestLocationAccess,
  reverseGeocode,
  type Coordinates,
} from '@/services/location';
import {
  formatPlace,
  useLocationStore,
  type LocationState,
} from '@/state/locationStore';
import { useAddressesStore } from '@/state/addressesStore';
import { findNearbySavedAddress } from '@/utils/addressProximity';

/** Foreground poll interval; background tracking is intentionally not used. */
const POLL_MS = 10_000;
const MOVE_THRESHOLD_M = 50;

function sameOrigin(a: Coordinates | null, b: Coordinates): boolean {
  return Boolean(a && distanceMeters(a, b) < MOVE_THRESHOLD_M);
}

function currentDevice(store: LocationState): Coordinates | null {
  const fix = store.deviceFix;
  if (!fix) return null;
  if (fix.latitude === 0 && fix.longitude === 0) return null;
  return { latitude: fix.latitude, longitude: fix.longitude };
}

/** Match a fix against the cached saved list (empty when it has not loaded — a safe no-match). */
function nearbyFor(coordinates: Coordinates) {
  return findNearbySavedAddress(
    coordinates,
    useAddressesStore.getState().addresses,
  );
}

/**
 * Reconcile the origin with a freshly read device position. When the user has not overridden the
 * origin, this adopts a saved address they are standing in (proximity auto-select) or follows the
 * device position. When they HAVE overridden, only `deviceFix` moves — the origin they chose stays.
 */
function applyDevicePosition(coordinates: Coordinates): void {
  useLocationStore.getState().syncActiveToDevice(nearbyFor(coordinates));
}

/**
 * Refresh the live fix. `prompt` = explicit user action (may show the OS dialog).
 *
 * Silent refreshes only run when permission was already granted AND Location
 * Services is on, so the app never prompts on launch and never pretends the last
 * stored coordinate is live while the OS master switch is off.
 */
export async function refreshLiveLocation(
  prompt = false,
): Promise<boolean> {
  const store = useLocationStore.getState();
  if (!prompt && !store.permissionGranted) return false;
  if (!prompt && !(await isLocationServicesEnabled())) {
    // Master switch off: no fix is possible. Surface it without wiping a chosen origin.
    store.setPermissionStatus('blocked', false, false);
    return false;
  }
  if (prompt) {
    const access = await requestLocationAccess();
    if (access !== 'granted') {
      store.setPermissionStatus(
        access === 'blocked' ? 'blocked' : 'denied',
        false,
        await isLocationServicesEnabled(),
      );
      return false;
    }
  }
  store.setLoading();
  try {
    const coordinates = prompt
      ? await getHighAccuracyPosition()
      : await getCoarsePosition();
    const previous = currentDevice(store);
    if (sameOrigin(previous, coordinates) && store.deviceFix?.address) {
      store.setDeviceFix({ coordinates });
      applyDevicePosition(coordinates);
      return true;
    }
    const place = await reverseGeocode(
      coordinates.latitude,
      coordinates.longitude,
    );
    store.setDeviceFix({
      coordinates,
      place,
      address:
        formatPlace(place) ||
        `${coordinates.latitude.toFixed(4)}, ${coordinates.longitude.toFixed(4)}`,
    });
    applyDevicePosition(coordinates);
    return true;
  } catch {
    if (prompt) store.setDenied();
    return false;
  }
}

/**
 * Outcome of an explicit "use my location" request. `blocked` means the OS will
 * not show the permission dialog again (iOS denial / Android "don't ask again");
 * the caller must send the user to Settings instead of retrying the prompt.
 */
export type LocationRequestResult = 'ready' | 'denied' | 'blocked' | 'failed';

/**
 * Explicit consent + fix for onboarding/manual location. Requests the OS
 * permission and, when granted, resolves a high-accuracy fix and address.
 *
 * This is also the "follow me again" action: it clears any saved/pinned override so the origin
 * tracks the device from here on.
 */
export async function requestAndRefreshLocation(): Promise<LocationRequestResult> {
  const store = useLocationStore.getState();
  store.setLoading();
  const access = await requestLocationAccess();
  if (access !== 'granted') {
    store.setPermissionStatus(
      access === 'blocked' ? 'blocked' : 'denied',
      false,
      await isLocationServicesEnabled(),
    );
    return access === 'blocked' ? 'blocked' : 'denied';
  }
  try {
    const coordinates = await getHighAccuracyPosition();
    const place = await reverseGeocode(
      coordinates.latitude,
      coordinates.longitude,
    );
    store.setDeviceFix({
      coordinates,
      place,
      address:
        formatPlace(place) ||
        `${coordinates.latitude.toFixed(4)}, ${coordinates.longitude.toFixed(4)}`,
    });
    // An explicit "use my location" is the user asking to follow the device again.
    const latest = useLocationStore.getState();
    latest.adoptDeviceAsActive();
    latest.syncActiveToDevice(nearbyFor(coordinates));
    return 'ready';
  } catch {
    store.setDenied();
    return 'failed';
  }
}

/**
 * Resume-time permission re-check. The user can grant/revoke location in the OS
 * Settings app while Faazio is backgrounded; on the next foreground the native
 * status is the truth, not the last persisted JS flag.
 *
 * - flip to granted → silent coarse fix (feeds re-sort from the new origin);
 * - flip to denied/blocked → nudge state for the Home banner (chosen origin kept);
 * - `undetermined`/`unavailable` → no state change (never invent a denial).
 */
async function reconcilePermissionOnResume(): Promise<void> {
  const store = useLocationStore.getState();
  try {
    const [access, servicesEnabled] = await Promise.all([
      getLocationAuthorizationStatus(),
      isLocationServicesEnabled(),
    ]);

    if (!servicesEnabled) {
      store.setPermissionStatus('blocked', false, false);
      return;
    }

    if (access === 'granted') {
      if (!store.permissionGranted) {
        // Newly granted outside the app: adopt it, then fetch silently.
        store.setPermissionStatus('idle', true, true);
        await refreshLiveLocation(false);
      } else {
        // Already granted: a cheap drift check keeps a moving user's origin fresh.
        await refreshLiveLocation(false);
      }
      return;
    }

    if (access === 'blocked') {
      store.setPermissionStatus('blocked', false, true);
      return;
    }

    if (access === 'denied') {
      store.setPermissionStatus('denied', false, true);
    }
  } finally {
    // The coverage gate holds the cold-start splash until the session's first fix attempt has
    // settled, so a persisted origin from a previous run cannot decide coverage by itself.
    // Idempotent: only the first attempt of the session is recorded.
    store.markFixAttempt();
  }
}

/**
 * Mount once at the app root. Hydrates the persisted fix, re-checks permission on
 * every foreground, then polls while the app is in the foreground. Unmount/
 * background clears the interval.
 */
export function useLiveLocation(enabled = true): void {
  const hydrate = useLocationStore((s) => s.hydrate);
  const status = useLocationStore((s) => s.status);
  const permissionGranted = useLocationStore((s) => s.permissionGranted);
  const servicesEnabled = useLocationStore((s) => s.servicesEnabled);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Resume re-check runs regardless of the current grant, so a user who fixed
  // permission in Settings is detected without a restart. It also covers the
  // first mount, which catches a grant made while the app was killed.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const check = () => {
      if (cancelled || AppState.currentState !== 'active') return;
      void reconcilePermissionOnResume();
    };
    check();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') check();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [enabled]);

  // Silent foreground poll. This runs even when the user picked a saved address elsewhere: the
  // device position must stay current so the checkout distance guardrail can compare the two.
  const shouldPoll =
    enabled &&
    permissionGranted &&
    servicesEnabled &&
    (status === 'ready' || status === 'loading' || status === 'idle');

  useEffect(() => {
    if (!shouldPoll) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const tick = () => {
      if (cancelled || AppState.currentState !== 'active') return;
      void refreshLiveLocation(false);
    };

    tick();
    timer = setInterval(tick, POLL_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [shouldPoll]);
}

/** Stable active origin (null until one exists); safe to use in useMemo deps. */
export function useLiveOrigin(): Coordinates | null {
  const status = useLocationStore((s) => s.status);
  const latitude = useLocationStore((s) => s.activeLocation?.latitude);
  const longitude = useLocationStore((s) => s.activeLocation?.longitude);
  return useMemo(
    () =>
      status === 'ready' &&
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      !(latitude === 0 && longitude === 0)
        ? { latitude, longitude }
        : null,
    [status, latitude, longitude],
  );
}

/** Stable hardware position (null until a fix exists) — for the distance guardrail only. */
export function useDeviceFix(): Coordinates | null {
  const latitude = useLocationStore((s) => s.deviceFix?.latitude);
  const longitude = useLocationStore((s) => s.deviceFix?.longitude);
  return useMemo(
    () =>
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      !(latitude === 0 && longitude === 0)
        ? { latitude, longitude }
        : null,
    [latitude, longitude],
  );
}
