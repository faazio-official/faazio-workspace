import {
  MART_HERO_BANNERS,
  MART_DEALS,
  MART_DAILY_ESSENTIALS,
  type MartHeroBanner,
  type MartDeal,
  type MartEssential,
} from '../mocks/martHomeFeed';
import { gateway, type ProductView } from '@/services/api/GatewayClient';
import type { StoreProfile } from '@data/types';

export interface MartFeed {
  heroBanners: MartHeroBanner[];
  deals: MartDeal[];
  dailyEssentials: MartEssential[];
  localVendors: StoreProfile[];
}

/**
 * Overlay the canonical catalog values (name/price/MRP/rating/image) onto one editorial `md-*`
 * deal row. The authored presentation copy (brand/size/discountTag/priceNote) stays; money comes
 * from the server so the rail never shows an invented price. Falls back to the fixture row when the
 * catalog has no matching product (`md-*` are seeded rows, so this only happens offline).
 */
function overlayDeal(deal: MartDeal, product?: ProductView): MartDeal {
  if (!product) return deal;
  return {
    ...deal,
    name: product.name,
    price: product.price,
    originalPrice: product.originalPrice ?? deal.originalPrice,
    rating: product.rating ?? deal.rating,
    imageUrl: product.image || deal.imageUrl,
  };
}

/**
 * Mart home feed. Vendors are **server-backed** (`directory.stores`, app=MART) and the `md-*`
 * deals resolve through the catalog (`catalog.products` via `getProductsByIds`) — both fall back
 * to the local fixture offline, so the feed never regresses. Hero banners and the `mf-*`
 * daily-essentials rail stay `@static-editorial` (no backing table) until they move to the SDUI
 * home doc (see docs/architecture/data-layer-sdui.md).
 */
export async function fetchMartFeed(): Promise<MartFeed> {
  const [localVendors, dealProducts] = await Promise.all([
    gateway.getStores('MART'),
    gateway.getProductsByIds(MART_DEALS.map((d) => d.id)).catch(() => [] as ProductView[]),
  ]);
  const byId = new Map(dealProducts.map((p) => [p.id, p]));
  return {
    heroBanners: MART_HERO_BANNERS,
    deals: MART_DEALS.map((d) => overlayDeal(d, byId.get(d.id))),
    dailyEssentials: MART_DAILY_ESSENTIALS,
    localVendors,
  };
}