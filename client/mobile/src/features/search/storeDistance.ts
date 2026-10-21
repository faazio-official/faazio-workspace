import { getStoreById } from '@data/directory/stores';
import { haversineKm, type LatLng } from '@/utils/distance';

/**
 * Distance from the live origin to the store that sells a search result, in km.
 * Returns undefined when the item has no `storeId` or the store has no pinned
 * coordinates (server rows created without a location, or offline fixtures the
 * geo helper could not resolve).
 */
export function storeDistanceKm(
  storeId: string | undefined,
  origin: LatLng | null,
): number | undefined {
  if (!origin || !storeId) return undefined;
  const store = getStoreById(storeId);
  if (
    !store ||
    typeof store.latitude !== 'number' ||
    typeof store.longitude !== 'number'
  ) {
    return undefined;
  }
  return haversineKm(origin, {
    latitude: store.latitude,
    longitude: store.longitude,
  });
}
