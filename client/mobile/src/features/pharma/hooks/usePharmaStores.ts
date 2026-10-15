import { useEffect, useState } from 'react';
import type { StoreProfile } from '@data/types';
import { pharmaStores } from '@data/pharma/stores';
import { gateway } from '@/services/api/GatewayClient';

/**
 * The pharmacy outlets for the Pharma home rails and the vendor picker.
 *
 * Remote-first: reads `directory.stores` (app=PHARMA) through
 * `GatewayClient.getStores`, which already falls back to the `@data` fixtures on
 * a network/HTTP error. When the gateway returns no rows we keep the seed so the
 * rails never render empty during the fixture→server migration.
 */
export function usePharmaStores(): StoreProfile[] {
  const [stores, setStores] = useState<StoreProfile[]>(pharmaStores);

  useEffect(() => {
    let active = true;
    gateway
      .getStores('PHARMA')
      .then((remote) => {
        if (active && remote.length > 0) setStores(remote);
      })
      .catch(() => {
        // getStores already falls back to the @data fixtures internally.
      });
    return () => {
      active = false;
    };
  }, []);

  return stores;
}