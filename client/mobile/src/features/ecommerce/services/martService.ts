import {
  MART_HERO_BANNERS,
  MART_DEALS,
  MART_FLASH_SALES,
  MART_TOP_BRANDS,
  MART_LOCAL_VENDORS,
  type MartHeroBanner,
  type MartDeal,
  type MartFlashSale,
  type MartTopBrand,
  type MartLocalVendor,
} from '../mocks/martHomeFeed';

export interface MartFeed {
  heroBanners: MartHeroBanner[];
  deals: MartDeal[];
  flashSales: MartFlashSale[];
  topBrands: MartTopBrand[];
  localVendors: MartLocalVendor[];
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
    flashSales: MART_FLASH_SALES,
    topBrands: MART_TOP_BRANDS,
    localVendors: MART_LOCAL_VENDORS,
  };
}
