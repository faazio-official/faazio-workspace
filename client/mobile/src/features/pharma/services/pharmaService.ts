import { gateway, type ProductView } from '@/services/api/GatewayClient';
import type { SduiBanner } from '@data/home/sdui';
import {
  PHARMA_QUICK_REORDER,
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

function toPopularMedicine(p: ProductView): PharmaPopularMedicine {
  return { id: p.id, name: p.name, details: p.desc ?? '', rating: p.rating, price: p.price, imageUrl: p.image };
}

function toHealthEssential(p: ProductView): PharmaHealthEssential {
  return { id: p.id, title: p.name, imageUrl: p.image };
}

/**
 * Pharma home feed. Pharmacy **stores** are server-backed (`directory.stores`, app=PHARMA) via
 * `usePharmaStores`. The two product rails and the house hero are now server-backed too: they read
 * the super-admin SDUI sections (`pharmaPopular`/`pharmaEssentials`/`pharmaHero`) through
 * `GET /sdui/pharma`, joined to the catalog. The `@data`/feature fixtures are the offline fallback,
 * so the rails never blank. Coupons/brands/health-corner stay curated editorial (no product refs).
 * Rx-gated products are never referenced by the public pharma rails.
 */
export async function fetchPharmaFeed(): Promise<PharmaFeed> {
  const sections = await gateway.getPharmaFeed();
  const section = (id: string) => sections.find((s) => (s.id as string) === id);
  const popular = section('pharmaPopular');
  const essentials = section('pharmaEssentials');
  const hero = section('pharmaHero');
  return {
    quickReorder: PHARMA_QUICK_REORDER,
    topOffers: PHARMA_TOP_OFFERS,
    popularMedicines: popular?.products?.length
      ? popular.products.map(toPopularMedicine)
      : PHARMA_POPULAR_MEDICINES,
    healthEssentials: essentials?.products?.length
      ? essentials.products.map(toHealthEssential)
      : PHARMA_HEALTH_ESSENTIALS,
    featuredBrands: PHARMA_FEATURED_BRANDS,
    healthCorner: PHARMA_HEALTH_CORNER,
    heroBanners: hero?.banners ?? [],
  };
}
