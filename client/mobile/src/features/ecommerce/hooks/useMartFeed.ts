import { useCallback, useEffect, useRef, useState } from 'react';
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

  return { feed, refreshing, refresh };
}