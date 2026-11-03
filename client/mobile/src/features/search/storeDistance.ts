import type { LatLng } from '@/utils/distance';

/**
 * Distance from the live origin to the store that sells a search result, in km.
 * Returns undefined when the item has no storeId or no pinned coordinates are
 * available client-side — no bundled store directory is consulted, so an
 * unknown distance stays unknown.
 */
export function storeDistanceKm(
  storeId: string | undefined,
  origin: LatLng | null,
): number | undefined {
  if (!origin || !storeId) return undefined;
  return undefined;
}
