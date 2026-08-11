export type AppBrand = 'FOOD' | 'MART' | 'GROCERY' | 'PHARMA';

export interface Product {
  id: string;
  name: string;
  price: number;
  emoji: string;
  image: string;
  desc: string;
  rating: number;
  app: AppBrand;
  category: string;
  badge?: string;
  badgeBg?: string;
  shop?: string;
  reviewsCount?: number;
  unit?: string;
  /**
   * Facetable product attributes, e.g. `{ processor: 'Apple M2', ram: '16GB',
   * brand: 'Apple' }`. Search facets are derived from these attributes across
   * the matched result set — never hand-mapped per keyword.
   */
  attributes?: Record<string, string | number | string[]>;
}

export interface MartProduct extends Product {
  app: 'MART';
  reviews: number;
}

export interface GroceryProduct extends Product {
  app: 'GROCERY';
  unit: string;
}

export interface PharmaProduct extends Product {
  app: 'PHARMA';
}

export interface FoodProduct extends Product {
  app: 'FOOD';
  categories: string[];
}

export interface StoreProfile {
  id: string;
  name: string;
  app: AppBrand;
  categories: string[];
  rating: number;
  reviewsCount?: number;
  deliveryTime: string;
  distance: string;
  coverImage: string;
  emoji: string;
  desc: string;
  offerTag?: string;
  isVeg?: boolean;
}

export interface StoreOffer {
  id: string;
  storeId: string;
  storeName: string;
  app: AppBrand;
  emoji: string;
  coverImage: string;
  offerTitle: string;
  offerTag: string;
  distance: string;
  rating: number;
}

export interface NearbyOffer extends Product {
  distance: string;
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  emoji: string;
  imageUrl?: string;
  originalPrice?: number;
  qtyDesc?: string;
  category?: CartCategory;
}

export type CartCategory = 'MART' | 'FOOD' | 'GROCERY' | 'PHARMA';

export interface Review {
  id: string;
  user: string;
  avatar?: string;
  rating: number;
  comment: string;
  date: string;
}

export interface Address {
  id: string;
  label: string;
  address: string;
  isDefault?: boolean;
}

export interface Coupon {
  code: string;
  discountPercent: number;
  label: string;
  minOrder?: number;
  isFreeDelivery?: boolean;
}

export interface BookingRecord {
  id: string;
  restaurantId: string;
  restaurantName: string;
  date: string;
  time: string;
  guests: number;
  status: 'pending' | 'confirmed' | 'cancelled';
}

export interface ExploreItem {
  id: string;
  name: string;
  price: number;
  rating: string;
  emoji: string;
  img: string;
  shop: string;
}

export interface ExploreStack {
  id: string;
  title: string;
  subtitle: string;
  type: AppBrand;
  accent: string;
  items: ExploreItem[];
}

export interface SpecItem {
  label: string;
  value: string;
}

/** Account order history entry (owner: features/profile). */
export interface PastOrder {
  id: string;
  item: string;
  store: string;
  price: number;
  date: string;
  status: string;
  app: AppBrand;
}

/** Top-of-week dish rail entry (owner: features/food). */
export interface TopOfWeekDish {
  id: string;
  name: string;
  price: number;
  emoji: string;
  image: string;
  desc: string;
  rating: string | number;
  reviewsCount?: number;
  time?: string;
}

/** Pharma department filter (owner: features/pharma). */
export interface PharmaCategory {
  id: string;
  name: string;
  count: string;
  icon: string;
}

/** Home explore sector tile (owner: features/home). */
export interface PortalSector {
  emoji: string;
  name: string;
  tagline: string;
  imageUrl: string;
  themeColor: string;
  app: AppBrand;
}

/** Home top ad banner slide (owner: features/home). */
export interface AdSlide {
  title: string;
  tagline: string;
  badge: string;
  imageUrl: string;
  targetApp: AppBrand;
}

/** Home sponsored ad card (owner: features/home). */
export interface SponsoredAd {
  title: string;
  tagline: string;
  brand: string;
  discount: string;
  imageUrl: string;
  targetApp: AppBrand;
}

/** Home "recently viewed history" rail item (owner: features/home). */
export interface RecentlyViewedItem {
  id: string;
  name: string;
  price: number;
  emoji: string;
  imageUrl: string;
  activityTag: string;
}

/** Home "today's offers" deal card (owner: features/home). */
export interface TodaysOffer {
  dishName: string;
  originalPrice: number;
  promoPrice: number;
  restaurant: string;
  discountBadge: string;
  emoji: string;
  image: string;
}

/** Home mixed-catalog recommendation card (owner: features/home). */
export interface MixedRecommendation {
  id: string;
  name: string;
  price: number;
  sector: string;
  rating: number;
  imageUrl: string;
}

/** Home popular dining card (owner: features/home). */
export interface PopularDiningItem {
  name: string;
  cuisine: string;
  price: number;
  rating: string;
  trending: boolean;
  image: string;
}

/** Home "Mart finds" card (owner: features/home). */
export interface FaMartFind {
  name: string;
  price: number;
  rating: string;
  tag: string;
  image: string;
}

/** Home restaurant specials card (owner: features/home). */
export interface RestaurantSpecial {
  name: string;
  cuisine: string;
  price: number;
  icon: string;
  image: string;
}
