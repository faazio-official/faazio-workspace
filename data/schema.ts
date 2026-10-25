/**
 * @aspirational SDUI contract. Types here are consumed by shared renderers
 * (`components/shared/SDUIRenderer`, `ProductCardBase`), but no data file
 * produces `SDUINode` trees yet — domain files emit typed entity arrays.
 * See data/DATA_CONTROL.md.
 */
import type { Product, StoreProfile, Review, AppBrand, SpecItem } from './types';

export type CardVariant = 'rail' | 'grid2' | 'stack' | 'tile' | 'detail-row' | 'flash' | 'promo';

export interface BannerProps {
  title: string;
  subtitle?: string;
  tagline?: string;
  imageUrl: string;
  accent: string;
  badge?: string;
  targetApp?: AppBrand;
  discount?: string;
  brand?: string;
  url?: string;
}

export interface PortalItem {
  emoji: string;
  name: string;
  tagline: string;
  imageUrl: string;
  themeColor: string;
  app: AppBrand;
}

export interface CategoryItem {
  id: string;
  name: string;
  emoji: string;
  color: string;
  ringColor?: string;
  type: AppBrand;
  count?: number;
}

export interface ProductCardLayout {
  columns?: 1 | 2;
  width?: number;
  height?: number;
}

export type SDUINode =
  | { type: 'Rail'; variant: 'snap' | 'list' | 'grid'; title?: string; subtitle?: string; children: SDUINode[] }
  | { type: 'Section'; title: string; subtitle?: string; spacing?: 'sm' | 'md' | 'lg'; children: SDUINode[] }
  | { type: 'ProductCard'; variant: CardVariant; appBrand: AppBrand; props: Product; layout?: ProductCardLayout }
  | { type: 'StoreCard'; appBrand: AppBrand; props: StoreProfile }
  | { type: 'Banner'; variant: 'gradient' | 'promo' | 'video'; props: BannerProps }
  | { type: 'Portal'; items: PortalItem[] }
  | { type: 'CategoryGrid'; items: CategoryItem[]; columns?: 2 | 3 }
  | { type: 'CategoryPill'; label: string; emoji: string; color: string }
  | { type: 'SearchBar'; placeholder?: string }
  | { type: 'EmptyState'; message: string; icon?: string }
  | { type: 'DetailHero'; product: Product }
  | { type: 'DetailBody'; product: Product; highlights: string[]; specs: SpecItem[] }
  | { type: 'DetailFooter'; product: Product }
  | { type: 'StepperRow'; quantity: number }
  | { type: 'ReviewRow'; reviews: Review[] }
  | { type: 'RatingBreakdown'; stars: Record<number, number> }
  | { type: 'CheckoutStep'; step: 'bag' | 'address' | 'payment' | 'receipt' }
  | { type: 'AdBanner'; slides: AdSlide[]; autoPlay?: boolean }
  | { type: 'SponsoredCard'; props: { title: string; tagline: string; brand?: string; discount?: string; imageUrl: string; targetApp?: AppBrand } };

export interface AdSlide {
  title: string;
  tagline: string;
  badge?: string;
  imageUrl: string;
  targetApp?: AppBrand;
}
