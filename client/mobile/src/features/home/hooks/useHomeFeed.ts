import { useCallback, useEffect, useState } from 'react';
import { gateway, type ProductView } from '@/services/api/GatewayClient';
import { useRefreshStore } from '@/state/refreshStore';
import type { SduiSection } from '@data/home/sdui';
import type { StoreRecord } from '@data/directory/stores';

/**
 * A Home feed section joined with its resolved rows (SDUI doc + catalog/store join).
 * `stores` is populated for restaurant rails (sections that carry `storeIds`).
 */
export type HomeFeedSection = SduiSection & { products: ProductView[]; stores?: StoreRecord[] };

export interface HomeFeedState {
  feed: HomeFeedSection[] | null;
  loading: boolean;
  error: boolean;
  /** True while a manual pull-to-refresh is in flight (the initial load shows the skeleton). */
  refreshing: boolean;
  /** Re-fetch the feed and signal the sibling header rail to re-fetch too. No-op while in flight. */
  refresh: () => void;
  /** Retry the failed read (empty/error state affordance). */
  reload: () => void;
}

/**
 * Server-driven Home SDUI doc. Returns the ordered sections the gateway compiles
 * (Mongo `sdui_layouts` joined to Postgres). No local fixture doc is substituted: while
 * the read is in flight `feed` is null and `loading` is true, and a failed read surfaces
 * `error` so the screen can show an honest empty/error state instead of fixtures.
 *
 * A pull (or retry) bumps the shared `home` counter, which both this hook and the header
 * category rail read, so one gesture refreshes the feed and its sibling rail together.
 * A failed refresh keeps the previously loaded rows (never blanks) and only flips `error`.
 */
export function useHomeFeed(): HomeFeedState {
  const [feed, setFeed] = useState<HomeFeedSection[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const homeTick = useRefreshStore((s) => s.home);
  const bump = useRefreshStore((s) => s.bump);

  useEffect(() => {
    if (!gateway.remoteEnabled) {
      setLoading(false);
      setError(false);
      setRefreshing(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(false);
    gateway
      .getHomeFeed()
      .then((sections) => {
        if (!active) return;
        setFeed(sections as HomeFeedSection[]);
      })
      .catch(() => {
        if (!active) return;
        // Keep the previously loaded rows so a failed pull never blanks the page.
        setError(true);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setRefreshing(false);
      });
    return () => {
      active = false;
    };
  }, [homeTick]);

  const refresh = useCallback(() => {
    if (refreshing) return;
    setRefreshing(true);
    bump('home');
  }, [refreshing, bump]);

  const reload = useCallback(() => bump('home'), [bump]);

  return { feed, loading, error, refreshing, refresh, reload };
}
