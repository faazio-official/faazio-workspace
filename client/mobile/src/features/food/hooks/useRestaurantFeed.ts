import { useEffect, useMemo, useState } from 'react';
import { haversineKm } from '@/utils/distance';
import { useLiveOrigin } from '@/hooks/useLiveLocation';
import { fetchRestaurantFeed, type RestaurantFeed } from '../services/restaurantFeedService';
import type { FoodRestaurant } from '../mocks/types';

/**
 * Nearest-first, recomputed from the live fix. Fixture rows already carry real
 * coordinates, so cards update in place as the poll lands without re-fetching.
 */
function byLiveDistance(
  restaurants: FoodRestaurant[],
  origin: { latitude: number; longitude: number } | null,
): FoodRestaurant[] {
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

export function useRestaurantFeed(): RestaurantFeed | null {
  const [feed, setFeed] = useState<RestaurantFeed | null>(null);
  const origin = useLiveOrigin();

  useEffect(() => {
    let active = true;
    fetchRestaurantFeed().then((data) => {
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
      restaurants: byLiveDistance(feed.restaurants, origin),
    };
  }, [feed, origin]);
}
