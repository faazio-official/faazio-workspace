import { useEffect, useState } from 'react';
import type { StoreProfile } from '@data/types';
import { pharmaStores } from '@data/pharma/stores';
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
 *  - server `200 []` → `empty-authoritative` (keeps the `@data` fixture visible so the rails never
 *    blank, but flagged as an authoritative empty)
 *  - fetch failure   → the `@data` fixture + `offline-fallback`
 */
export function usePharmaStores(): PharmaStoresFeed {
  const [feed, setFeed] = useState<PharmaStoresFeed>({ stores: pharmaStores, source: 'offline-fallback' });

  useEffect(() => {
    let active = true;
    gateway
      .fetchStores('PHARMA')
      .then((remote) => {
        if (!active) return;
        if (remote.length > 0) setFeed({ stores: remote, source: 'live' });
        else setFeed({ stores: pharmaStores, source: 'empty-authoritative' });
      })
      .catch(() => {
        if (active) setFeed({ stores: pharmaStores, source: 'offline-fallback' });
      });
    return () => {
      active = false;
    };
  }, []);

  return feed;
}