import {
  MART_HERO_BANNERS,
  MART_DEALS,
  MART_DAILY_ESSENTIALS,
  type MartHeroBanner,
  type MartDeal,
  type MartEssential,
} from '../mocks/martHomeFeed';
import { gateway } from '@/services/api/GatewayClient';
import type { StoreProfile } from '@data/types';

export interface MartFeed {
  heroBanners: MartHeroBanner[];
  deals: MartDeal[];
  dailyEssentials: MartEssential[];
  localVendors: StoreProfile[];
}

/**
 * Mart home feed. Vendors are **server-backed** (`directory.stores`, app=MART) via
 * `GatewayClient.getStores`, which falls back to the local directory fixture offline,
 * so the feed never regresses. Curated banners/deals/essentials stay feature-local
 * until they move to the SDUI home doc (see docs/architecture/data-layer-sdui.md).
 */
export async function fetchMartFeed(): Promise<MartFeed> {
  const localVendors = await gateway.getStores('MART');
  return {
    heroBanners: MART_HERO_BANNERS,
    deals: MART_DEALS,
    dailyEssentials: MART_DAILY_ESSENTIALS,
    localVendors,
  };
}