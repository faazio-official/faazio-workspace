import {
  MART_HERO_BANNERS,
  MART_DEALS,
  MART_DAILY_ESSENTIALS,
  type MartHeroBanner,
  type MartDeal,
  type MartEssential,
} from '../mocks/martHomeFeed';
import { gateway, type ProductView } from '@/services/api/GatewayClient';
import type { SduiBanner } from '@data/home/sdui';
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

/** Project one SDUI hero banner onto the carousel's card shape (accent → bgHex). */
function heroBannerFrom(banner: SduiBanner, index: number): MartHeroBanner {
  return {
    id: banner.id || `hb-${index + 1}`,
    title: banner.title,
    subtitle: banner.subtitle ?? '',
    bgHex: banner.accent ?? '#FFF8D6',
    imageUrl: banner.imageUrl ?? '',
  };
}

/**
 * Project one catalog row onto the daily-essentials card. Presentation fields (brand/size) come
 * from the entry's own `shop`/`unit`/attributes; a discount tag is derived from MRP when the
 * catalog has no authored badge. Money is always the server's.
 */
function essentialFromProduct(p: ProductView): MartEssential {
  const original = p.originalPrice && p.originalPrice > p.price ? p.originalPrice : p.price;
  const brand = p.shop ?? (typeof p.attributes?.brand === 'string' ? p.attributes.brand : '');
  const size = p.unit ?? (typeof p.attributes?.packSize === 'string' ? p.attributes.packSize : '');
  const discountTag =
    p.badge ?? (original > p.price ? `${Math.round((1 - p.price / original) * 100)}% OFF` : '');
  return {
    id: p.id,
    brand,
    name: p.name,
    size,
    price: p.price,
    originalPrice: original,
    discountTag,
    rating: p.rating,
    imageUrl: p.image,
    emoji: p.emoji,
  };
}

/** Find a Mart section by id in the compiled Home SDUI feed (ids are plain strings, not the Home registry). */
function martSection<T extends { id: unknown }>(feed: T[], id: string): T | undefined {
  return feed.find((s) => (s.id as string) === id);
}

/**
 * Mart home feed. Vendors are **server-backed** (`directory.stores`, app=MART) and the `md-*`
 * deals resolve through the catalog (`catalog.products` via `getProductsByIds`). The hero banners
 * and daily-essentials rail are now **server-controlled** through the Mongo SDUI home doc
 * (`martHero.banners` / `martEssentials.productIds`) via `GET /sdui/home`, so merchandising is
 * portal-editable without a release. Every leg falls back to the local fixture offline, so the feed
 * never regresses. `mocks/martHomeFeed.ts` is retained as the offline first-paint fallback only.
 */
export async function fetchMartFeed(): Promise<MartFeed> {
  const [feed, localVendors, dealProducts] = await Promise.all([
    gateway.getHomeFeed().catch(() => []),
    gateway.getStores('MART'),
    gateway.getProductsByIds(MART_DEALS.map((d) => d.id)).catch(() => [] as ProductView[]),
  ]);

  const hero = martSection(feed, 'martHero');
  const essentials = martSection(feed, 'martEssentials');

  const heroBanners = hero?.banners?.length
    ? hero.banners.map(heroBannerFrom)
    : MART_HERO_BANNERS;
  const dailyEssentials =
    essentials?.products?.length
      ? essentials.products.map(essentialFromProduct)
      : MART_DAILY_ESSENTIALS;

  const byId = new Map(dealProducts.map((p) => [p.id, p]));
  return {
    heroBanners,
    deals: MART_DEALS.map((d) => overlayDeal(d, byId.get(d.id))),
    dailyEssentials,
    localVendors,
  };
}