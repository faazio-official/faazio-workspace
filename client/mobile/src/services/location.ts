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
  /**
   * The revenue/administrative district (`subAdminArea` on Android, `subAdministrativeArea` on
   * iOS). Distinct from `district`, which is the sub-locality: for a taluk town such as Lalgudi,
   * `district` is "Lalgudi" while this is "Tiruchirappalli" — the value coverage is keyed on.
   */
  adminDistrict?: string | null;
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
  isLocationServicesEnabled?: () => Promise<boolean>;
  /** Android: show the OS "Turn on location" dialog. iOS: resolves the current switch only. */
  requestEnableLocation?: () => Promise<EnableLocationResult>;
  geocodeAddress?: (address: string) => Promise<Coordinates | null>;
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

/**
 * OS "Location Services" master switch — separate from this app's runtime grant. With it off no
 * fix is possible at all, so callers must fall back to manual entry instead of trusting the last
 * stored coordinate. A missing native method (older shell) is reported as `true` because the app
 * grant check alone is still meaningful.
 */
export async function isLocationServicesEnabled(): Promise<boolean> {
  if (!nativeGeocoder?.isLocationServicesEnabled) {
    // Android always has the permission API available; the master switch is unknown without it.
    if (Platform.OS === 'android') {
      return PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
    }
    return true;
  }
  try {
    return await nativeGeocoder.isLocationServicesEnabled();
  } catch {
    return false;
  }
}

/** How long a first-time iOS authorization prompt may stay unanswered before we stop waiting. */
const IOS_AUTHORIZATION_TIMEOUT_MS = 60_000;

/**
 * Ask the OS to turn Location Services on. On Android this opens the system "Turn on location"
 * dialog (Play Services resolution); on iOS the OS exposes no programmatic toggle, so it resolves
 * the current switch and the caller must direct the user to Settings.
 *
 * - `enabled` — location is on afterwards;
 * - `cancelled` — the user dismissed the Android system dialog and it is still off;
 * - `unavailable` — no dialog could be shown (iOS, or no foreground Activity).
 */
export type EnableLocationResult = 'enabled' | 'cancelled' | 'unavailable';

export async function requestEnableLocation(): Promise<EnableLocationResult> {
  // Android: fire the native Play Services "Turn on location" / "Cancel" dialog through
  // react-native-android-location-enabler (SettingsClient + ResolvableApiException under the
  // hood). Never import it on iOS — its TurboModule is Android-only and resolves eagerly.
  if (Platform.OS === 'android') {
    try {
      const { promptForEnableLocationIfNeeded } = await import(
        'react-native-android-location-enabler'
      );
      const result = await promptForEnableLocationIfNeeded({
        interval: 10_000,
        waitForAccurate: false,
      });
      return result === 'enabled' || result === 'already-enabled'
        ? 'enabled'
        : 'cancelled';
    } catch {
      // The user tapped "Cancel"/"No thanks", or this OEM build cannot show the Play Services
      // dialog. Report the real provider state rather than guessing.
      return (await isLocationServicesEnabled()) ? 'enabled' : 'cancelled';
    }
  }

  if (!nativeGeocoder?.requestEnableLocation) {
    return (await isLocationServicesEnabled()) ? 'enabled' : 'unavailable';
  }
  try {
    const status = await nativeGeocoder.requestEnableLocation();
    if (status === 'enabled' || status === 'cancelled') return status;
    return 'unavailable';
  } catch {
    return (await isLocationServicesEnabled()) ? 'enabled' : 'unavailable';
  }
}

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

/**
 * Best-effort forward geocode of an address string. Saved addresses are stored as text, so this is
 * how a selected saved address becomes the live nearby-feed origin. Resolves `null` when the
 * address cannot be resolved — callers must never invent coordinates.
 */
export async function geocodeAddress(
  address: string,
): Promise<Coordinates | null> {
  if (!nativeGeocoder?.geocodeAddress) return null;
  const trimmed = address.trim();
  if (!trimmed) return null;
  try {
    return await nativeGeocoder.geocodeAddress(trimmed);
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
