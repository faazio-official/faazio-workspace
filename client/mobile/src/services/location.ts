/**
 * Location access. Position comes from
 * `@react-native-community/geolocation`; reverse geocoding is served by the
 * thin native `FaazioGeocoder` module (Android `Geocoder`, iOS `CLGeocoder`),
 * so coordinates never leave the device. Consent is requested by the caller
 * before any of these functions run.
 */
import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

Geolocation.setRNConfiguration({
  skipPermissionRequests: false,
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

/** One-shot fix. Triggers the OS permission prompt when not yet granted. */
export function getCurrentPosition(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      (error) => reject(error),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
    );
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
