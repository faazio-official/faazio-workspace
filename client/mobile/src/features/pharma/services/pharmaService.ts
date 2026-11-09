import { gateway, type ProductView, type ReadSource } from '@/services/api/GatewayClient';
import { effectivePrice, fetchActiveDiscounts } from '@/services/pricing';
import type { SduiBanner, SduiSection } from '@data/home/sdui';
import type { Product } from '@data/types';
import type {
  PharmaQuickReorderItem,
  PharmaTopOffer,
  PharmaPopularMedicine,
  PharmaHealthEssential,
  PharmaFeaturedBrand,
  PharmaHealthCornerArticle,
} from '../types';

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
   * The coupon code the house hero may advertise, or `null` to show none. Only ever a code the
   * server honours (`GET /coupons?app=PHARMA`), so the hero can never advertise a code
   * `POST /checkout/validate-coupon` would reject; offline/disabled → `null`.
   */
  heroCouponCode: string | null;
  /** Provenance of the server-backed rails so a screen can label a fixture/offline view. */
  source: ReadSource;
}

const PHARMA_PLACEHOLDER_IMG =
  'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?fm=jpg&fit=crop&q=80&w=400&h=400';

/** Map a Quick Reorder medicine to a unified Product. Quick Reorder items carry
 *  no image/rating, so a medicine icon placeholder and a default rating are used. */
export const quickReorderToProduct = (item: PharmaQuickReorderItem): Product => ({
  id: item.id,
  app: 'PHARMA',
  category: 'medicine',
  name: item.name,
  price: item.price,
  emoji: 'pharma',
  rating: 4.5,
  desc: item.stripDetails,
  image: PHARMA_PLACEHOLDER_IMG,
  unit: item.stripDetails,
  attributes: { type: 'Medicine', brand: 'Faazio Pharma', packSize: item.stripDetails },
});

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

function toHealthEssential(p: ProductView): PharmaHealthEssential {
  return { id: p.id, title: p.name, imageUrl: p.image };
}

/**
 * Pharma home feed. Pharmacy **stores** are server-backed (`directory.stores`, app=PHARMA) via
 * `usePharmaStores`. The product rails and the house hero are server-backed too: they read the
 * super-admin SDUI sections (`pharmaPopular`/`pharmaEssentials`/`pharmaHero`) through
 * `GET /sdui/pharma`, joined to the catalog, with approved festival discounts overlaid on the
 * shopper price (same `services/pricing` pipeline as Mart). The product rails are strictly
 * server-backed: a failed/absent SDUI section leaves the rail empty (never a bundled fixture).
 * Rx-gated products are never referenced by the public pharma rails. Quick Reorder, Top Offers,
 * Featured Brands and Health Corner have no server source yet, so they render empty until wired.
 */
export async function fetchPharmaFeed(): Promise<PharmaFeed> {
  let sections: (SduiSection & { products: ProductView[] })[];
  let source: ReadSource;
  try {
    sections = await gateway.fetchPharmaSections();
    source = sections.length > 0 ? 'live' : 'empty-authoritative';
  } catch {
    // Offline / remote disabled — no fixture rails; the screen renders its offline state.
    sections = [];
    source = 'offline-fallback';
  }
  const section = (id: string) => sections.find((s) => (s.id as string) === id);
  const popular = section('pharmaPopular');
  const essentials = section('pharmaEssentials');
  const hero = section('pharmaHero');

  const popularProducts = popular?.products?.length ? popular.products : null;

  // One discount batch covering the shown product rail so every shown price matches the price
  // `internal/checkout` settles (`contracts.DiscountReader`).
  const discounts = await fetchActiveDiscounts(popularProducts?.map((p) => p.id) ?? []);

  return {
    quickReorder: [],
    topOffers: [],
    popularMedicines: popularProducts
      ? popularProducts.map((p) => toPopularMedicine(p, discounts[p.id]?.discountPercent ?? 0))
      : [],
    healthEssentials: essentials?.products?.length
      ? essentials.products.map(toHealthEssential)
      : [],
    featuredBrands: [],
    healthCorner: [],
    heroBanners: hero?.banners ?? [],
    // No server-honoured offer feed exists yet, so the house hero never advertises a code.
    heroCouponCode: null,
    source,
  };
}