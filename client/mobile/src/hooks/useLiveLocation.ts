import { useEffect, useMemo } from 'react';
import { AppState } from 'react-native';
import {
  distanceMeters,
  getCoarsePosition,
  getCurrentAddress,
  getHighAccuracyPosition,
  requestLocationPermission,
  reverseGeocode,
  type Coordinates,
} from '@/services/location';
import { formatPlace, useLocationStore } from '@/state/locationStore';

/** Foreground poll interval; background tracking is intentionally not used. */
const POLL_MS = 10_000;
const MOVE_THRESHOLD_M = 50;

function sameOrigin(a: Coordinates | null, b: Coordinates): boolean {
  return Boolean(a && distanceMeters(a, b) < MOVE_THRESHOLD_M);
}

/**
 * Refresh the live fix. `prompt` = explicit user action (may show the OS dialog).
 * Silent refreshes only run when permission was already granted, so the app
 * never prompts on launch.
 */
export async function refreshLiveLocation(
  prompt = false,
): Promise<boolean> {
  const store = useLocationStore.getState();
  if (!prompt && !store.permissionGranted) return false;
  if (prompt) {
    const granted = await requestLocationPermission();
    if (!granted) {
      store.setDenied();
      return false;
    }
  }
  store.setLoading();
  try {
    const coordinates = prompt
      ? await getHighAccuracyPosition()
      : await getCoarsePosition();
    const previous =
      store.status === 'ready'
        ? { latitude: store.latitude, longitude: store.longitude }
        : null;
    if (sameOrigin(previous, coordinates) && store.address) {
      store.setFix({ coordinates });
      return true;
    }
    const place = await reverseGeocode(
      coordinates.latitude,
      coordinates.longitude,
    );
    store.setFix({
      coordinates,
      place,
      address:
        formatPlace(place) ||
        `${coordinates.latitude.toFixed(4)}, ${coordinates.longitude.toFixed(4)}`,
    });
    return true;
  } catch {
    if (prompt) store.setDenied();
    return false;
  }
}

/**
 * Explicit consent + fix for onboarding/manual location. Requests the OS
 * permission and, when granted, resolves a high-accuracy fix and address.
 */
export async function requestAndRefreshLocation(): Promise<boolean> {
  const store = useLocationStore.getState();
  store.setLoading();
  try {
    const resolved = await getCurrentAddress();
    if (!resolved) {
      store.setDenied();
      return false;
    }
    store.setFix({
      coordinates: resolved.coordinates,
      place: resolved.place,
      address:
        formatPlace(resolved.place) ||
        `${resolved.coordinates.latitude.toFixed(4)}, ${resolved.coordinates.longitude.toFixed(4)}`,
    });
    return true;
  } catch {
    store.setDenied();
    return false;
  }
}

/**
 * Mount once at the app root. Hydrates the persisted fix, then polls while the
 * app is in the foreground. Unmount/background clears the interval.
 */
export function useLiveLocation(enabled = true): void {
  const hydrate = useLocationStore((s) => s.hydrate);
  const permissionGranted = useLocationStore((s) => s.permissionGranted);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!enabled || !permissionGranted) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const tick = () => {
      if (cancelled || AppState.currentState !== 'active') return;
      void refreshLiveLocation(false);
    };

    tick();
    timer = setInterval(tick, POLL_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      sub.remove();
    };
  }, [enabled, permissionGranted]);
}

/** Stable live origin (null until the first fix); safe to use in useMemo deps. */
export function useLiveOrigin(): Coordinates | null {
  const status = useLocationStore((s) => s.status);
  const latitude = useLocationStore((s) => s.latitude);
  const longitude = useLocationStore((s) => s.longitude);
  return useMemo(
    () =>
      status === 'ready' && latitude !== 0 && longitude !== 0
        ? { latitude, longitude }
        : null,
    [status, latitude, longitude],
  );
}
