import { gateway, type ProductView, type ReadSource } from '@/services/api/GatewayClient';
import { effectivePrice, fetchActiveDiscounts } from '@/services/pricing';
import type { SduiBanner, SduiSection } from '@data/home/sdui';
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
  /**
   * The coupon code the house hero may advertise, or `null` to show none. Remote mode only ever
   * returns a code the server honours (`GET /coupons?app=PHARMA`), so the hero can never advertise a
   * code `POST /checkout/validate-coupon` would reject; mock mode keeps the editorial fixture for the
   * local demo checkout.
   */
  heroCouponCode: string | null;
  /** Provenance of the server-backed rails so a screen can label a fixture/offline view. */
  source: ReadSource;
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

function toQuickReorder(p: ProductView, discountPercent = 0): PharmaQuickReorderItem {
  const price = effectivePrice(p.price, discountPercent);
  const mrp = listPrice(p);
  return {
    id: p.id,
    name: p.name,
    stripDetails: p.unit ?? p.desc ?? '',
    price,
    ...(price < mrp ? { mrp } : {}),
  };
}

function toHealthEssential(p: ProductView): PharmaHealthEssential {
  return { id: p.id, title: p.name, imageUrl: p.image };
}

/**
 * The set of coupon codes the server actually honours for Pharma, or `null` in mock mode (where the
 * checkout is local, so the editorial offers can safely stand as a demo). In remote mode this is
 * ALWAYS a Set — on a failed/empty read it is an empty Set, so the rail hides rather than advertising
 * a fixture code (`MED20`/`FREEDEL`/…) that `contracts.CouponValidator` would reject at checkout.
 */
async function livePharmaOfferCodes(): Promise<Set<string> | null> {
  if (!gateway.remoteEnabled) return null;
  try {
    const coupons = await gateway.getCoupons('PHARMA');
    return new Set(coupons.map((c) => c.code));
  } catch {
    return new Set();
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
  let sections: (SduiSection & { products: ProductView[] })[];
  let source: ReadSource;
  try {
    sections = await gateway.fetchPharmaSections();
    source = sections.length > 0 ? 'live' : 'empty-authoritative';
  } catch {
    // Offline / remote disabled — the `@data` + feature fixtures stand, but flagged as a fallback.
    sections = await gateway.getPharmaFeed();
    source = 'offline-fallback';
  }
  const section = (id: string) => sections.find((s) => (s.id as string) === id);
  const popular = section('pharmaPopular');
  const essentials = section('pharmaEssentials');
  const hero = section('pharmaHero');

  const popularProducts = popular?.products?.length ? popular.products : null;

  // One discount batch covering both product rails so every shown price matches the price
  // `internal/checkout` settles (`contracts.DiscountReader`).
  const [quickReorderResolved, discounts, liveCodes] = await Promise.all([
    gateway.getProductsByIds(PHARMA_QUICK_REORDER_IDS).catch(() => [] as ProductView[]),
    fetchActiveDiscounts([
      ...(popularProducts?.map((p) => p.id) ?? []),
      ...PHARMA_QUICK_REORDER_IDS,
    ]),
    livePharmaOfferCodes(),
  ]);

  // Remote: only the server-honoured codes. Mock: the editorial fixture (local demo checkout).
  const topOffers = liveCodes
    ? PHARMA_TOP_OFFERS.filter((offer) => liveCodes.has(offer.code))
    : PHARMA_TOP_OFFERS;

  return {
    quickReorder: quickReorderResolved.length
      ? quickReorderResolved.map((p) => toQuickReorder(p, discounts[p.id]?.discountPercent ?? 0))
      : PHARMA_QUICK_REORDER,
    topOffers,
    popularMedicines: popularProducts
      ? popularProducts.map((p) => toPopularMedicine(p, discounts[p.id]?.discountPercent ?? 0))
      : PHARMA_POPULAR_MEDICINES,
    healthEssentials: essentials?.products?.length
      ? essentials.products.map(toHealthEssential)
      : PHARMA_HEALTH_ESSENTIALS,
    featuredBrands: PHARMA_FEATURED_BRANDS,
    healthCorner: PHARMA_HEALTH_CORNER,
    heroBanners: hero?.banners ?? [],
    // The hero advertises exactly the first Top Offer code (server-honoured in remote, the editorial
    // fixture in mock) — so the banner can never claim a code the rail below doesn't show, and never
    // one checkout would reject.
    heroCouponCode: topOffers[0]?.code ?? null,
    source,
  };
}
