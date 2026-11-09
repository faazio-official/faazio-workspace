import { useCallback, useEffect, useState } from 'react';
import { fetchPharmaFeed, type PharmaFeed } from '../services/pharmaService';

export interface PharmaFeedState {
  feed: PharmaFeed | null;
  /** True while a manual pull-to-refresh is in flight (the initial load shows the skeleton). */
  refreshing: boolean;
  /** Re-fetch the feed (pull-to-refresh). No-op while one is in flight. */
  refresh: () => void;
}

/**
 * Pharma home feed. The service never rejects (a failed read degrades to an empty,
 * offline-labelled feed), so a failed pull keeps the previously loaded rails and just
 * stops the spinner — it never blanks or invents data.
 */
export function usePharmaFeed(): PharmaFeedState {
  const [feed, setFeed] = useState<PharmaFeed | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    fetchPharmaFeed()
      .then((data) => {
        if (active) setFeed(data);
      })
      .catch(() => {
        // Keep the previous feed; a failed read never fabricates or blanks.
      })
      .finally(() => {
        if (active) setRefreshing(false);
      });
    return () => {
      active = false;
    };
  }, [nonce]);

  const refresh = useCallback(() => {
    if (refreshing) return;
    setRefreshing(true);
    setNonce((n) => n + 1);
  }, [refreshing]);

  return { feed, refreshing, refresh };
}
