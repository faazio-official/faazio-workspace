import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sortByDistance, withLiveDistance } from '@/utils/distance';
import { useLiveOrigin } from '@/hooks/useLiveLocation';
import { fetchMartFeed, type MartFeed } from '../services/martService';

export interface MartFeedState {
  feed: MartFeed | null;
  /** True while a manual pull-to-refresh is in flight (the initial load shows the skeleton). */
  refreshing: boolean;
  /** Re-fetch the feed (pull-to-refresh / retry affordance). No-op while one is in flight. */
  refresh: () => void;
}

/**
 * Loads the Mart home feed once, then exposes a `refresh` for pull-to-refresh / retry.
 * `fetchMartFeed` never rejects (it degrades each leg to fixtures), so the skeleton only ever
 * shows until the first resolve and can never stick.
 */
export function useMartFeed(): MartFeedState {
  const [feed, setFeed] = useState<MartFeed | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);
  const origin = useLiveOrigin();

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const load = useCallback(async () => {
    const data = await fetchMartFeed();
    if (mounted.current) setFeed(data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(() => {
    if (refreshing) return;
    setRefreshing(true);
    void load().finally(() => {
      if (mounted.current) setRefreshing(false);
    });
  }, [load, refreshing]);

  // Nearest-first local vendors, recomputed as the live fix changes (no re-fetch).
  const liveFeed = useMemo(() => {
    if (!feed) return null;
    return {
      ...feed,
      localVendors: sortByDistance(
        feed.localVendors.map((store) => withLiveDistance(store, origin)),
      ),
    };
  }, [feed, origin]);

  return { feed: liveFeed, refreshing, refresh };
}
