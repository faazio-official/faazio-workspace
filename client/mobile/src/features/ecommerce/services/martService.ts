import {
  MART_HERO_BANNERS,
  MART_DEALS,
  MART_DAILY_ESSENTIALS,
  type MartHeroBanner,
  type MartDeal,
  type MartEssential,
} from '../mocks/martHomeFeed';
import { martStores } from '@data/mart/stores';
import type { StoreProfile } from '@data/types';

export interface MartFeed {
  heroBanners: MartHeroBanner[];
  deals: MartDeal[];
  dailyEssentials: MartEssential[];
  localVendors: StoreProfile[];
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Simulated network boundary for the Mart home feed. Once the Go Chi backend
 * (server/) lands, replace the internals with an API client while keeping the
 * `MartFeed` shape intact.
 */
export async function fetchMartFeed(): Promise<MartFeed> {
  await delay(700);
  return {
    heroBanners: MART_HERO_BANNERS,
    deals: MART_DEALS,
    dailyEssentials: MART_DAILY_ESSENTIALS,
    localVendors: martStores,
  };
}
