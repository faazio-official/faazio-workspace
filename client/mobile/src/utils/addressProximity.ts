/**
 * Proximity matching between a device fix and the caller's saved addresses.
 *
 * Deliberately free of store/gateway imports: the location poller calls it on every fix, and it is
 * pure so it can be tested without the network stack.
 */
import type { SavedAddress } from '@data/types';
import { haversineKm, type LatLng } from '@/utils/distance';

/** A saved address is "here" within this radius. Tight enough to mean the same building. */
export const NEARBY_RADIUS_M = 200;

export interface NearbySavedAddress {
  addressId: string;
  coordinates: LatLng;
  address: string;
}

/** Coordinates of a saved row, or null when it has never been pinned. */
export function addressPoint(a: SavedAddress): LatLng | null {
  if (typeof a.latitude !== 'number' || typeof a.longitude !== 'number') return null;
  if (a.latitude === 0 && a.longitude === 0) return null;
  return { latitude: a.latitude, longitude: a.longitude };
}

/**
 * The saved address the user is currently standing in, or `null`.
 *
 * Rows without a stored point are skipped rather than forward-geocoded: matching a text address
 * against a GPS fix would need a network call on every poll, and could match a different point than
 * the one the user saved. A row is only a proximity candidate once it has a real pin.
 */
export function findNearbySavedAddress(
  coordinates: LatLng,
  addresses: SavedAddress[],
  radiusM: number = NEARBY_RADIUS_M,
): NearbySavedAddress | null {
  let best: NearbySavedAddress | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const row of addresses) {
    const point = addressPoint(row);
    if (!point) continue;
    const d = haversineKm(coordinates, point) * 1000;
    if (d > radiusM || d >= bestDistance) continue;
    bestDistance = d;
    best = { addressId: row.id, coordinates: point, address: row.address };
  }

  return best;
}
