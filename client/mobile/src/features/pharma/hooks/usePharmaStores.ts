import { useEffect, useMemo, useState } from 'react';
import type { StoreProfile } from '@data/types';
import { sortByDistance, withLiveDistance } from '@/utils/distance';
import { useLiveOrigin } from '@/hooks/useLiveLocation';
import { gateway, type ReadSource } from '@/services/api/GatewayClient';

/** The pharmacy outlets plus provenance so the rails can label a fixture/offline view. */
export interface PharmaStoresFeed {
  stores: StoreProfile[];
  source: ReadSource;
}

/**
 * The pharmacy outlets for the Pharma home rails and the vendor picker.
 *
 * Remote-first through the no-fallback `GatewayClient.fetchStores('PHARMA')` (`directory.stores`):
 *  - live rows       → `source: 'live'`
 *  - server `200 []` → `empty-authoritative` (honest empty; no fixture substitute)
 *  - fetch failure   → empty + `offline-fallback` (the screen renders its own offline state)
 */
export function usePharmaStores(): PharmaStoresFeed {
  const [feed, setFeed] = useState<PharmaStoresFeed>({ stores: [], source: 'offline-fallback' });
  const origin = useLiveOrigin();

  useEffect(() => {
    let active = true;
    gateway
      .fetchStores('PHARMA')
      .then((remote) => {
        if (!active) return;
        if (remote.length > 0) setFeed({ stores: remote, source: 'live' });
        else setFeed({ stores: [], source: 'empty-authoritative' });
      })
      .catch(() => {
        if (active) setFeed({ stores: [], source: 'offline-fallback' });
      });
    return () => {
      active = false;
    };
  }, []);

  // Nearest pharmacy first, recomputed as the live fix moves (no re-fetch).
  return useMemo(
    () => ({
      ...feed,
      stores: sortByDistance(
        feed.stores.map((store) => withLiveDistance(store, origin)),
      ),
    }),
    [feed, origin],
  );
}
