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
import { martStores } from '@data/mart/stores';
import type { SduiBanner } from '@data/home/sdui';
import type { StoreProfile } from '@data/types';

export interface MartFeed {
  deals: MartDeal[];
  dailyEssentials: MartEssential[];
  /** Editorial house hero (`martHero.banners` from `GET /sdui/mart`); paid MART_HERO renders first. */
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

/** Project one catalog row onto a Mart deal card when no authored `md-*` copy exists (a portal
 *  re-merchandise of an arbitrary product). Mirrors `essentialFromProduct`; money is the server's.
 */
function dealFromProduct(p: ProductView): MartDeal {
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
 * Mart home feed. Vendors are **server-backed** (`directory.stores`, app=MART). The `martDeals` and
 * `martEssentials` rails are **server-controlled** through the Mongo SDUI home doc
 * (`martDeals.productIds` / `martEssentials.productIds`) via `GET /sdui/mart`, so merchandising is
 * portal-editable without a release (the `md-*`/`gr-*` fixtures are offline first-paint fallbacks
 * only). The Mart hero is paid first (`MART_HERO` from `GET /ads/hero`); `martHero.banners` is the
 * editorial **house fallback** rendered only when there is no LIVE fill (`CampaignHero fallback`).
 * Never fabricated — absent section → fixture, present-but-empty section → empty (a portal typo is
 * visible, not masked). Every leg degrades to the local fixture independently (partial render) so
 * one failing route never blanks the feed; the whole body is guarded so the caller never sees a
 * rejected promise (fixes skeleton-forever).
 */
export async function fetchMartFeed(): Promise<MartFeed> {
  try {
    // `getMartFeed`/`getStores` never reject (withFallback → fixture), so no per-leg catch is needed.
    const [feed, localVendors] = await Promise.all([
      gateway.getMartFeed(),
      gateway.getStores('MART'),
    ]);

    const dealsSection = martSection(feed, 'martDeals');
    const essentials = martSection(feed, 'martEssentials');
    const hero = martSection(feed, 'martHero');

    const authoredById = new Map(MART_DEALS.map((d) => [d.id, d]));
    // Section present → trust its joined products (authored copy overlaid when the row is known);
    // section absent (offline / older doc) → the local fixture.
    const deals = dealsSection
      ? dealsSection.products.map((p) => overlayDeal(authoredById.get(p.id) ?? dealFromProduct(p), p))
      : MART_DEALS;

    const dailyEssentials = essentials
      ? essentials.products.map(essentialFromProduct)
      : MART_DAILY_ESSENTIALS;

    return {
      deals,
      dailyEssentials,
      heroBanners: hero?.banners ?? [],
      localVendors,
    };
  } catch {
    return {
      deals: MART_DEALS,
      dailyEssentials: MART_DAILY_ESSENTIALS,
      heroBanners: [],
      // Offline first-paint: the local Mart directory keeps the "Local Vendors" footer renderable
      // instead of blanking to an empty "No vendors found" state.
      localVendors: martStores,
    };
  }
}