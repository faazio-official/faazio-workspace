import { useEffect, useMemo, useState } from 'react';
import { haversineKm } from '@/utils/distance';
import { useLiveOrigin } from '@/hooks/useLiveLocation';
import { fetchDiningFeed, type DiningFeed } from '../services/diningService';
import type { DiningRestaurant } from '../mocks/types';

/**
 * Nearest-first, recomputed from the live fix. Fixture rows already carry real
 * coordinates, so cards update in place as the poll lands without re-fetching.
 */
function byLiveDistance(
  restaurants: DiningRestaurant[],
  origin: { latitude: number; longitude: number } | null,
): DiningRestaurant[] {
  if (!origin) return restaurants;
  return restaurants
    .map((r) => {
      if (!r.latitude || !r.longitude) return r;
      const km = haversineKm(origin, {
        latitude: r.latitude,
        longitude: r.longitude,
      });
      return { ...r, distance: km };
    })
    .sort((a, b) => {
      const da = a.latitude && a.longitude ? a.distance : Number.POSITIVE_INFINITY;
      const db = b.latitude && b.longitude ? b.distance : Number.POSITIVE_INFINITY;
      return da - db;
    });
}

export function useDiningFeed(): DiningFeed | null {
  const [feed, setFeed] = useState<DiningFeed | null>(null);
  const origin = useLiveOrigin();

  useEffect(() => {
    let active = true;
    fetchDiningFeed().then((data) => {
      if (active) setFeed(data);
    });
    return () => {
      active = false;
    };
  }, []);

  return useMemo(() => {
    if (!feed) return null;
    return {
      ...feed,
      topRated: byLiveDistance(feed.topRated, origin),
      dining: byLiveDistance(feed.dining, origin),
    };
  }, [feed, origin]);
}
