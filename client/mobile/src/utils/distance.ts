/**
 * Distance helpers for live-location ordering. All math is device-local; the
 * origin coordinates are never logged or sent anywhere except as the two
 * `lat`/`lng` query params of a nearby read.
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface MaybeGeo {
  latitude?: number;
  longitude?: number;
  distance?: string;
  distanceKm?: number;
}

const EARTH_RADIUS_KM = 6371.0088;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in kilometres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Short, human label: "450 m", "1.8 km". Zero/unknown → empty string. */
export function formatDistanceKm(km: number | undefined): string {
  if (km === undefined || !Number.isFinite(km) || km < 0) return '';
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  return `${km.toFixed(1)} km`;
}

/** Fill `distanceKm` / `distance` from a live origin, preserving server values. */
export function withLiveDistance<T extends MaybeGeo>(
  item: T,
  origin: LatLng | null,
): T & { distanceKm?: number; distance?: string } {
  if (
    item.distanceKm !== undefined ||
    !origin ||
    typeof item.latitude !== 'number' ||
    typeof item.longitude !== 'number'
  ) {
    return item;
  }
  const km = haversineKm(origin, {
    latitude: item.latitude,
    longitude: item.longitude,
  });
  return { ...item, distanceKm: km, distance: formatDistanceKm(km) };
}

/** Nearest-first; items without a distance keep their relative order at the end. */
export function sortByDistance<T extends MaybeGeo>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const da = a.distanceKm;
    const db = b.distanceKm;
    if (da === undefined && db === undefined) return 0;
    if (da === undefined) return 1;
    if (db === undefined) return -1;
    return da - db;
  });
}

/** True when the next fix moved far enough to justify a reverse geocode. */
export function movedEnough(
  previous: LatLng | null,
  next: LatLng,
  thresholdMeters = 50,
): boolean {
  if (!previous) return true;
  return haversineKm(previous, next) * 1000 >= thresholdMeters;
}
