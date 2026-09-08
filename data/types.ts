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
  /** Pre-discount / list price, if the item is on offer. Mirrors the backend MRP field. */
  originalPrice?: number;
  /**
   * Facetable product attributes, e.g. `{ processor: 'Apple M2', ram: '16GB',
   * brand: 'Apple' }`. Search facets are derived from these attributes across
   * the matched result set — never hand-mapped per keyword.
   */
  attributes?: Record<string, string | number | string[]>;
  /**
   * Id of the `StoreProfile` this product is sold by / picked up from.
   * Drives store-backed self-pickup points at checkout.
   */
  storeId?: string;
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
  /** Pickup address. Present → the store itself is a valid self-pickup point. */
  address?: string;
  /** Pickup contact phone for the store. */
  phone?: string;
  /** Pickup hours for the store. */
  hours?: string;
}

/** Mart "Deals of the Day" product (owner: features/ecommerce). */
export interface MartDeal {
  id: string;
  brand: string;
  name: string;
  size: string;
  price: number;
  originalPrice: number;
  discountTag: string;
  imageUrl: string;
  emoji: string;
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

/**
 * How an order is fulfilled at checkout. Defaults to delivery; pickup waives the
 * delivery fee and routes to a pickup point instead of a delivery address.
 * Contract the future Go Chi backend will mirror.
 */
export type FulfillmentMode = 'DELIVERY' | 'PICKUP';

/** A self-pickup location an order can be collected from (owner: features/cart). */
export interface PickupPoint {
  id: string;
  name: string;
  address: string;
  phone: string;
  hours: string;
  isActive?: boolean;
}

/** Address tag pill shown on the "Saved Addresses" screen (owner: features/profile). */
export type AddressTag = 'HOME' | 'WORK' | 'OTHER';

/** A saved delivery address card (owner: features/profile / Saved Addresses). */
export interface SavedAddress {
  id: string;
  tag: AddressTag;
  isDefault?: boolean;
  name: string;
  phone: string;
  address: string;
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

/** Delivery status of an order shown on the My Orders screen. */
export type OrderStatus = 'Delivered' | 'Shipped' | 'Processing' | 'Cancelled';

/** One tappable status filter on the My Orders screen (owner: features/profile). */
export type MyOrdersStatusFilter =
  | 'All Orders'
  | 'Processing'
  | 'Shipped'
  | 'Delivered'
  | 'Cancelled';

/** Rich order card fixture for the My Orders screen (owner: features/profile). */
export interface MyOrder {
  id: string;
  orderNumber: string;
  orderDateTime: string;
  productName: string;
  variant: string;
  qty: number;
  price: number;
  status: OrderStatus;
  statusDate: string;
  emoji: string;
  /** Sub-app the order belongs to (drives the My Orders sub-app rail). */
  app: AppBrand;
  /** Fulfillment mode. Absent = delivery (back-compat with existing fixtures). */
  fulfillment?: FulfillmentMode;
  /**
   * Id of the real `Product` this order maps to (searched via `getProductById`).
   * Absent = the order has no drill-in to a product detail page.
   */
  productId?: string;
}

/** Status filter definition (labels only — counts are derived at runtime). */
export interface MyOrdersStatusFilterItem {
  name: MyOrdersStatusFilter;
}

/** Signed-in user profile (owner: features/profile / My Account). */
export interface UserProfile {
  name: string;
  email: string;
  phone: string;
}

/** Smart Saver membership summary (owner: features/profile / My Account). */
export interface SaverMembership {
  title: string;
  savedLabel: string;
  savedAmount: number;
}

/** One My Orders status column (owner: features/profile / My Account). */
export interface OrderStatusCount {
  key: string;
  label: string;
  count: number;
}

/** One tappable row in the Account navigation list (owner: features/profile). */
export interface AccountNavRow {
  key: string;
  icon: string;
  title: string;
  subtitle: string;
}

/** Grouped navigation rows for the My Account screen. */
export interface AccountNavGroup {
  key: string;
  rows: AccountNavRow[];
}

/** One info row in the "Your Details" screen (owner: features/profile). */
export interface UserDetailRow {
  icon: string;
  title: string;
  subtitle: string;
}

/** Source-of-truth payload for the "Your Details" screen. */
export interface UserDetailsData {
  accountId: string;
  personalInfo: UserDetailRow[];
  preferences: UserDetailRow[];
  securityTitle: string;
  securitySubtitle: string;
}

/** Food dining "today's special" dish (owner: features/food). */
export interface SpecialDish {
  id: string;
  dishName: string;
  restaurant: string;
  price: number;
  image: string;
  isVeg: boolean;
  description: string;
  cuisine?: string;
  rating?: number;
  deliveryTime?: string;
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
