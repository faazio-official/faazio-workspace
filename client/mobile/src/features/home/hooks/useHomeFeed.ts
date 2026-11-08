import { useCallback, useEffect, useState } from 'react';
import { gateway, type ProductView } from '@/services/api/GatewayClient';
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
  reload: () => void;
}

/**
 * Server-driven Home SDUI doc. Returns the ordered sections the gateway compiles
 * (Mongo `sdui_layouts` joined to Postgres). No local fixture doc is substituted: while
 * the read is in flight `feed` is null and `loading` is true, and a failed read surfaces
 * `error` so the screen can show an honest empty/error state instead of fixtures.
 */
export function useHomeFeed(): HomeFeedState {
  const [feed, setFeed] = useState<HomeFeedSection[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!gateway.remoteEnabled) {
      setFeed(null);
      setLoading(false);
      setError(false);
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
        setFeed(null);
        setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { feed, loading, error, reload };
}
