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

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Simulated network boundary for the Pharma home feed. Once the Go Chi backend
 * (server/) lands, replace the internals with an API client while keeping the
 * `PharmaFeed` shape intact.
 */
export async function fetchPharmaFeed(): Promise<PharmaFeed> {
  await delay(700);
  return {
    quickReorder: PHARMA_QUICK_REORDER,
    topOffers: PHARMA_TOP_OFFERS,
    popularMedicines: PHARMA_POPULAR_MEDICINES,
    healthEssentials: PHARMA_HEALTH_ESSENTIALS,
    featuredBrands: PHARMA_FEATURED_BRANDS,
    healthCorner: PHARMA_HEALTH_CORNER,
  };
}
