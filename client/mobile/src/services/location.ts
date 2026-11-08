/**
 * Location access. Position comes from
 * `@react-native-community/geolocation`; reverse geocoding is served by the
 * thin native `FaazioGeocoder` module (Android `Geocoder`, iOS `CLGeocoder`),
 * so coordinates never leave the device. Consent is requested by the caller
 * before any of these functions run.
 */
import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

// Permission is requested explicitly (never implicitly by a background/silent
// refresh), so a poll can never surface an OS dialog the user did not trigger.
Geolocation.setRNConfiguration({
  skipPermissionRequests: true,
  authorizationLevel: 'whenInUse',
});

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface ReverseGeocodeResult {
  city?: string | null;
  district?: string | null;
  region?: string | null;
  postalCode?: string | null;
  street?: string | null;
  name?: string | null;
}

/**
 * Foreground location grant state.
 * - `granted` — the app may read position.
 * - `denied` — refused, but the OS may still show the dialog on a later request (Android).
 * - `blocked` — refused permanently (iOS denied/restricted, or Android "don't ask again");
 *   the OS will not prompt again and the only recovery is the Settings app.
 * - `undetermined` — not asked yet.
 * - `unavailable` — the native permission layer could not answer (e.g. timeout).
 */
export type LocationAccess =
  | 'granted'
  | 'denied'
  | 'blocked'
  | 'undetermined'
  | 'unavailable';

interface NativeGeocoder {
  reverseGeocode(
    latitude: number,
    longitude: number,
  ): Promise<ReverseGeocodeResult | null>;
  getLocationAuthorizationStatus?: () => Promise<LocationAccess>;
}

const nativeGeocoder = (NativeModules as { FaazioGeocoder?: NativeGeocoder })
  .FaazioGeocoder;

export function isReverseGeocodingAvailable(): boolean {
  return Boolean(nativeGeocoder?.reverseGeocode);
}

/** Current iOS authorization — never prompts. Android reports only "granted" or "undetermined". */
export async function getLocationAuthorizationStatus(): Promise<LocationAccess> {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    return granted ? 'granted' : 'undetermined';
  }

  if (!nativeGeocoder?.getLocationAuthorizationStatus) return 'unavailable';
  try {
    return await nativeGeocoder.getLocationAuthorizationStatus();
  } catch {
    return 'unavailable';
  }
}

/** How long a first-time iOS authorization prompt may stay unanswered before we stop waiting. */
const IOS_AUTHORIZATION_TIMEOUT_MS = 60_000;

/**
 * Ask the OS for foreground location access and report why it could not be granted.
 * The caller must show its own consent copy before invoking this.
 *
 * iOS only exposes the system dialog while the status is `notDetermined`. Once the user has
 * picked "Don't Allow", re-calling `requestAuthorization` is a no-op (and the geolocation
 * library's callback never fires), so check the status first and return `blocked` instead of
 * hanging the caller.
 */
export async function requestLocationAccess(): Promise<LocationAccess> {
  if (Platform.OS === 'android') {
    const current = await getLocationAuthorizationStatus();
    if (current === 'granted') return 'granted';

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    if (result === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
    if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'blocked';
    return 'denied';
  }

  const current = await getLocationAuthorizationStatus();
  if (current === 'granted' || current === 'blocked') return current;

  return new Promise<LocationAccess>((resolve) => {
    let settled = false;
    const finish = (access: LocationAccess) => {
      if (settled) return;
      settled = true;
      resolve(access);
    };

    const timer = setTimeout(
      () => finish('unavailable'),
      IOS_AUTHORIZATION_TIMEOUT_MS,
    );

    Geolocation.requestAuthorization(
      () => {
        clearTimeout(timer);
        finish('granted');
      },
      () => {
        clearTimeout(timer);
        // A denied/restricted status now means the dialog will never appear again.
        void getLocationAuthorizationStatus().then((status) =>
          finish(status === 'granted' ? 'blocked' : status),
        );
      },
    );
  });
}

/**
 * Ask the OS for foreground location access. Returns true when granted.
 * The caller must show its own consent copy before invoking this.
 */
export async function requestLocationPermission(): Promise<boolean> {
  return (await requestLocationAccess()) === 'granted';
}

export interface PositionOptions {
  highAccuracy?: boolean;
  /** Accept a cached fix up to this age (ms). Coarse foreground polls use 10s. */
  maximumAge?: number;
  timeout?: number;
}

/** One-shot fix. Triggers the OS permission prompt when not yet granted. */
export function getCurrentPosition(
  options: PositionOptions = {},
): Promise<Coordinates> {
  const {
    highAccuracy = false,
    maximumAge = 60000,
    timeout = 15000,
  } = options;
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      (error) => reject(error),
      { enableHighAccuracy: highAccuracy, timeout, maximumAge },
    );
  });
}

/** Accurate fix for an explicit "use my location" action (splash/onboarding/pin picker). */
export function getHighAccuracyPosition(): Promise<Coordinates> {
  return getCurrentPosition({ highAccuracy: true, maximumAge: 0, timeout: 15000 });
}

/** Cheap foreground poll: network-assisted, tolerates a 10s-old cached fix. */
export function getCoarsePosition(): Promise<Coordinates> {
  return getCurrentPosition({
    highAccuracy: false,
    maximumAge: 10000,
    timeout: 10000,
  });
}

/** Best-effort reverse geocode; resolves `null` when unavailable. */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodeResult | null> {
  if (!nativeGeocoder?.reverseGeocode) return null;
  try {
    return await nativeGeocoder.reverseGeocode(latitude, longitude);
  } catch {
    return null;
  }
}

/** Convenience: permission + fix + geocode in one call. */
export async function getCurrentAddress(): Promise<{
  coordinates: Coordinates;
  place: ReverseGeocodeResult | null;
} | null> {
  const granted = await requestLocationPermission();
  if (!granted) return null;

  const coordinates = await getCurrentPosition();
  const place = await reverseGeocode(coordinates.latitude, coordinates.longitude);
  return { coordinates, place };
}

/** Great-circle distance in metres (local helper; no dependency on the UI utils). */
export function distanceMeters(a: Coordinates, b: Coordinates): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(h)));
}
