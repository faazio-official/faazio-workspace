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

interface NativeGeocoder {
  reverseGeocode(
    latitude: number,
    longitude: number,
  ): Promise<ReverseGeocodeResult | null>;
}

const nativeGeocoder = (NativeModules as { FaazioGeocoder?: NativeGeocoder })
  .FaazioGeocoder;

export function isReverseGeocodingAvailable(): boolean {
  return Boolean(nativeGeocoder?.reverseGeocode);
}

/**
 * Ask the OS for foreground location access. Returns true when granted.
 * The caller must show its own consent copy before invoking this.
 */
export async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }

  return new Promise((resolve) => {
    Geolocation.requestAuthorization(
      () => resolve(true),
      () => resolve(false),
    );
  });
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
