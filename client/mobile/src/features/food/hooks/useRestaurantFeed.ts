import { useCallback, useEffect, useMemo, useState } from 'react';
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

export interface RestaurantFeedState {
  feed: RestaurantFeed | null;
  /** True when the feed request failed and there is no previous feed to show. */
  error: boolean;
  reload: () => void;
}

export function useRestaurantFeed(): RestaurantFeedState {
  const [feed, setFeed] = useState<RestaurantFeed | null>(null);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const origin = useLiveOrigin();

  useEffect(() => {
    let active = true;
    setError(false);
    fetchRestaurantFeed()
      .then((data) => {
        if (active) setFeed(data);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  const value = useMemo(() => {
    if (!feed) return null;
    return {
      ...feed,
      topRated: byLiveDistance(feed.topRated, origin),
      restaurants: byLiveDistance(feed.restaurants, origin),
    };
  }, [feed, origin]);

  return { feed: value, error, reload };
}
