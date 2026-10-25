import { useEffect, useState } from 'react';
import { gateway, type ProductView } from '@/services/api/GatewayClient';
import type { SduiSection } from '@data/home/sdui';
import type { StoreRecord } from '@data/directory/stores';

/**
 * A Home feed section joined with its resolved rows (SDUI doc + catalog/store join).
 * `stores` is populated for dining rails (sections that carry `storeIds`).
 */
export type HomeFeedSection = SduiSection & { products: ProductView[]; stores?: StoreRecord[] };

/**
 * Server-driven Home SDUI doc. Returns the ordered sections the gateway compiles
 * (Mongo `sdui_layouts` joined to Postgres) once loaded, or `null` while loading/offline.
 * No local fixture doc is substituted.
 */
export function useHomeFeed(): HomeFeedSection[] | null {
  const [feed, setFeed] = useState<HomeFeedSection[] | null>(null);
  useEffect(() => {
    let active = true;
    gateway
      .getHomeFeed()
      .then((sections) => {
        if (active) setFeed(sections as HomeFeedSection[]);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return feed;
}