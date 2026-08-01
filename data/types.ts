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

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  emoji: string;
  imageUrl?: string;
}

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
