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
}

/**
 * Pharma home feed. Pharmacy **stores** are already server-backed
 * (`directory.stores`, app=PHARMA) via `usePharmaStores` → `GatewayClient.getStores`.
 * The rails here (quick-reorder, offers, health corner, brands) are curated
 * editorial content, and the two product rails below use presentation-only fixture
 * ids (`pm-*`, `pe-*`) that are not catalog rows — they move to `catalog.products`
 * when they get their own app contract (SDUI home, `data-layer-sdui.md`), not before.
 */
export async function fetchPharmaFeed(): Promise<PharmaFeed> {
  return {
    quickReorder: PHARMA_QUICK_REORDER,
    topOffers: PHARMA_TOP_OFFERS,
    popularMedicines: PHARMA_POPULAR_MEDICINES,
    healthEssentials: PHARMA_HEALTH_ESSENTIALS,
    featuredBrands: PHARMA_FEATURED_BRANDS,
    healthCorner: PHARMA_HEALTH_CORNER,
  };
}
