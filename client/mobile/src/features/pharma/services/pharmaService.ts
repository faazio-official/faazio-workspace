import { gateway, type ProductView } from '@/services/api/GatewayClient';
import { effectivePrice, fetchActiveDiscounts } from '@/services/pricing';
import type { SduiBanner } from '@data/home/sdui';
import {
  PHARMA_QUICK_REORDER,
  PHARMA_QUICK_REORDER_IDS,
  PHARMA_TOP_OFFERS,
  PHARMA_POPULAR_MEDICINES,
  PHARMA_HEALTH_ESSENTIALS,
  PHARMA_FEATURED_BRANDS,
  PHARMA_HEALTH_CORNER,
  type PharmaQuickReorderItem,
  type PharmaTopOffer,
  type PharmaPopularMedicine,
  type PharmaHealthEssential,
  type PharmaFeaturedBrand,
  type PharmaHealthCornerArticle,
} from '../mocks/pharmaHomeFeed';

export interface PharmaFeed {
  quickReorder: PharmaQuickReorderItem[];
  topOffers: PharmaTopOffer[];
  popularMedicines: PharmaPopularMedicine[];
  healthEssentials: PharmaHealthEssential[];
  featuredBrands: PharmaFeaturedBrand[];
  healthCorner: PharmaHealthCornerArticle[];
  /** Organic house-hero banners (`pharmaHero.banners` from `GET /sdui/pharma`); paid PHARMA_HERO wins. */
  heroBanners: SduiBanner[];
}

/** The list price to strike through beside an effective price (authored MRP, else base). */
function listPrice(p: ProductView): number {
  return p.originalPrice && p.originalPrice > p.price ? p.originalPrice : p.price;
}

function toPopularMedicine(p: ProductView, discountPercent = 0): PharmaPopularMedicine {
  const price = effectivePrice(p.price, discountPercent);
  const mrp = listPrice(p);
  return {
    id: p.id,
    name: p.name,
    details: p.desc ?? '',
    rating: p.rating,
    price,
    ...(price < mrp ? { mrp } : {}),
    imageUrl: p.image,
  };
}

function toQuickReorder(p: ProductView): PharmaQuickReorderItem {
  return { id: p.id, name: p.name, stripDetails: p.unit ?? p.desc ?? '', price: p.price };
}

function toHealthEssential(p: ProductView): PharmaHealthEssential {
  return { id: p.id, title: p.name, imageUrl: p.image };
}

/**
 * The set of coupon codes the server actually honours for Pharma, or `null` when it cannot be
 * ruled on (mock/offline or an empty/failed read). `null` means "show the editorial offers as-is";
 * a non-null set means an advertised code must exist server-side or it is dropped — the rail never
 * advertises a discount the shopper cannot claim at checkout.
 */
async function livePharmaOfferCodes(): Promise<Set<string> | null> {
  if (!gateway.remoteEnabled) return null;
  try {
    const coupons = await gateway.getCoupons('PHARMA');
    if (coupons.length === 0) return null;
    return new Set(coupons.map((c) => c.code));
  } catch {
    return null;
  }
}

/**
 * Pharma home feed. Pharmacy **stores** are server-backed (`directory.stores`, app=PHARMA) via
 * `usePharmaStores`. The two product rails and the house hero are server-backed too: they read the
 * super-admin SDUI sections (`pharmaPopular`/`pharmaEssentials`/`pharmaHero`) through
 * `GET /sdui/pharma`, joined to the catalog, with approved festival discounts overlaid on the
 * shopper price (same `services/pricing` pipeline as Mart). Quick Reorder resolves its REAL catalog
 * ids (`getProductsByIds`) so a tap opens a canonical PDP and an add-to-cart id checkout can price;
 * Top Offers are filtered to live server coupons when online. The `@data`/feature fixtures are the
 * offline fallback, so the rails never blank. Rx-gated products are never referenced by the public
 * pharma rails.
 */
export async function fetchPharmaFeed(): Promise<PharmaFeed> {
  const sections = await gateway.getPharmaFeed();
  const section = (id: string) => sections.find((s) => (s.id as string) === id);
  const popular = section('pharmaPopular');
  const essentials = section('pharmaEssentials');
  const hero = section('pharmaHero');

  const popularProducts = popular?.products?.length ? popular.products : null;

  const [quickReorderResolved, discounts, liveCodes] = await Promise.all([
    gateway.getProductsByIds(PHARMA_QUICK_REORDER_IDS).catch(() => [] as ProductView[]),
    fetchActiveDiscounts(popularProducts?.map((p) => p.id) ?? []),
    livePharmaOfferCodes(),
  ]);

  return {
    quickReorder: quickReorderResolved.length
      ? quickReorderResolved.map(toQuickReorder)
      : PHARMA_QUICK_REORDER,
    topOffers: liveCodes
      ? PHARMA_TOP_OFFERS.filter((offer) => liveCodes.has(offer.code))
      : PHARMA_TOP_OFFERS,
    popularMedicines: popularProducts
      ? popularProducts.map((p) => toPopularMedicine(p, discounts[p.id]?.discountPercent ?? 0))
      : PHARMA_POPULAR_MEDICINES,
    healthEssentials: essentials?.products?.length
      ? essentials.products.map(toHealthEssential)
      : PHARMA_HEALTH_ESSENTIALS,
    featuredBrands: PHARMA_FEATURED_BRANDS,
    healthCorner: PHARMA_HEALTH_CORNER,
    heroBanners: hero?.banners ?? [],
  };
}
