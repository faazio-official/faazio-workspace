import {
  MART_DEALS,
  MART_DAILY_ESSENTIALS,
  dealToProduct,
  essentialToProduct,
  type MartDeal,
  type MartEssential,
} from '../mocks/martHomeFeed';
import { gateway, type ActiveDiscount, type ProductView } from '@/services/api/GatewayClient';
import { applyActiveDiscount } from '@/services/pricing';
import type { SduiBanner } from '@data/home/sdui';
import type { StoreProfile } from '@data/types';

export interface MartFeed {
  deals: MartDeal[];
  dailyEssentials: MartEssential[];
  /** Editorial house hero (`martHero.banners` from `GET /sdui/home`); paid MART_HERO renders first. */
  heroBanners: SduiBanner[];
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

/** Project one catalog row onto the daily-essentials card. Presentation fields (brand/size) come
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
 * Overlay the server-owned festival discount onto the Deals rail so the shopper pays the same price
 * here as on the paid shelf / vendor drill-in. Presentation copy is kept; only money moves, and only
 * when the server discount actually lowers it (`{}` → untouched — no synthesized discount).
 */
export function priceDeals(deals: MartDeal[], map: Record<string, ActiveDiscount>): MartDeal[] {
  return deals.map((deal) => {
    const priced = applyActiveDiscount(dealToProduct(deal), map[deal.id]);
    return {
      ...deal,
      price: priced.price,
      originalPrice: priced.originalPrice ?? deal.originalPrice,
    };
  });
}

/** Same price authority for the Daily-Essentials rail (see `priceDeals`). */
export function priceEssentials(
  items: MartEssential[],
  map: Record<string, ActiveDiscount>,
): MartEssential[] {
  return items.map((item) => {
    const priced = applyActiveDiscount(essentialToProduct(item), map[item.id]);
    return {
      ...item,
      price: priced.price,
      originalPrice: priced.originalPrice ?? item.originalPrice,
    };
  });
}

/**
 * Mart home feed. Vendors are **server-backed** (`directory.stores`, app=MART) and the `md-*`
 * deals resolve through the catalog (`catalog.products` via `getProductsByIds`). The daily-essentials
 * rail is **server-controlled** through the Mongo SDUI home doc (`martEssentials.productIds`) via
 * `GET /sdui/home`, so merchandising is portal-editable without a release. The Mart hero is paid
 * first (`MART_HERO` from `GET /ads/hero`); `martHero.banners` is the editorial **house fallback**
 * rendered only when there is no LIVE fill (`CampaignHero fallback`). Never fabricated — empty when
 * the SDUI doc has no banners. Every leg degrades to the local fixture independently (partial render)
 * so one failing route never blanks the feed; the whole body is guarded so the caller never sees a
 * rejected promise (fixes skeleton-forever).
 */
export async function fetchMartFeed(): Promise<MartFeed> {
  try {
    const [feed, localVendors, dealProducts] = await Promise.all([
      gateway.getHomeFeed().catch(() => []),
      gateway.getStores('MART').catch(() => [] as StoreProfile[]),
      gateway.getProductsByIds(MART_DEALS.map((d) => d.id)).catch(() => [] as ProductView[]),
    ]);

    const essentials = martSection(feed, 'martEssentials');
    const hero = martSection(feed, 'martHero');

    const dailyEssentials =
      essentials?.products?.length
        ? essentials.products.map(essentialFromProduct)
        : MART_DAILY_ESSENTIALS;

    const byId = new Map(dealProducts.map((p) => [p.id, p]));
    return {
      deals: MART_DEALS.map((d) => overlayDeal(d, byId.get(d.id))),
      dailyEssentials,
      heroBanners: hero?.banners ?? [],
      localVendors,
    };
  } catch {
    return {
      deals: MART_DEALS,
      dailyEssentials: MART_DAILY_ESSENTIALS,
      heroBanners: [],
      localVendors: [],
    };
  }
}