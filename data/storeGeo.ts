/**
 * Approximate store/venue coordinates for the offline fixtures.
 *
 * Live rows carry real `latitude`/`longitude` from `directory.stores`
 * (migration 0041). Fixtures have no geo columns, so this derives a stable,
 * deterministic point from the store id and its authored `distance` label.
 * The same helper runs in the seed generator, so a fresh database and the
 * offline app agree on where a fixture store sits.
 */
export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/** Fictional "Greenwood City" centre used by the Mart/Food/Pharma fixtures. */
const GEO_BASE: GeoPoint = { latitude: 17.44, longitude: 78.38 };

/** Stable 32-bit hash (FNV-1a) so a store id always maps to the same bearing. */
function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Parse the numeric km out of a fixture distance label ("1.8 km"). */
export function distanceKmFromLabel(label?: string): number {
  const value = Number.parseFloat(String(label ?? ''));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** Deterministic point `distanceKm` from the fixture centre on a stable bearing. */
export function approximateGeo(id: string, distanceKm: number): GeoPoint {
  const bearing = ((hashId(id) % 360) * Math.PI) / 180;
  const km = Math.max(0.2, distanceKm || 0.6);
  const dLat = (km / 111.32) * Math.cos(bearing);
  const dLng =
    (km / (111.32 * Math.cos((GEO_BASE.latitude * Math.PI) / 180))) *
    Math.sin(bearing);
  return {
    latitude: Number((GEO_BASE.latitude + dLat).toFixed(6)),
    longitude: Number((GEO_BASE.longitude + dLng).toFixed(6)),
  };
}

/** Add coordinates when a fixture row does not already carry them. */
export function withStoreGeo<
  T extends {
    id: string;
    distance?: string;
    latitude?: number;
    longitude?: number;
  },
>(store: T): T & GeoPoint {
  if (
    typeof store.latitude === 'number' &&
    typeof store.longitude === 'number'
  ) {
    return store as T & GeoPoint;
  }
  const geo = approximateGeo(store.id, distanceKmFromLabel(store.distance));
  return { ...store, ...geo };
}
