/**
 * @mock Simulates a Rust + Tantivy search-index microservice. Flat, deduplicated,
 * pre-tokenized product records — consolidates mart/grocery/food/pharma/home/explore/
 * categories product data. See data/DATA_CONTROL.md.
 */
import type { Product, NearbyOffer, ExploreItem, ExploreStack } from '../types';
import { martProducts } from '../mart/products';
import { MART_DEALS, dealToProduct } from '../mart/deals';
import { groceryProducts } from '../grocery/products';
import { foodProducts } from '../food/products';
import { TODAYS_SPECIALS, dishToProduct } from '../food/specials';
import { BOOKING_DISHES_DB, type BookingDish } from '../food/bookingDishes';
import { pharmaProducts, PHARMA_CATEGORIES } from '../pharma/products';
import { mensPicks, womensPicks, childrensPicks, hairSkinPicks } from '../home/demographics';
import { instantFeed } from '../home/instantFeed';
import { nearbyOffers } from '../home/nearbyOffers';
import { recentlyViewedMart, recentlyViewedFood, recentlyViewedGrocery, recentlyViewedPharma, hotBrandDeals } from '../home/rails';
import { exploreStacks } from '../explore/stacks';
import { categoriesSearchDatabase } from '../categories/searchDatabase';

export interface CatalogEntry {
  id: string;
  app: 'FOOD' | 'MART' | 'GROCERY' | 'PHARMA';
  category: string;
  name: string;
  searchTokens: string[];
  price: number;
  originalPrice?: number;
  rating: number;
  emoji: string;
  image: string;
  desc: string;
  badge?: string;
  shop?: string;
  reviewsCount?: number;
  unit?: string;
  attributes?: Record<string, string | number | string[]>;
}

export interface CatalogFacetCategory {
  id: string;
  name: string;
  count: string;
  icon: string;
}

export const pharmaFacetCategories: CatalogFacetCategory[] = PHARMA_CATEGORIES.map((c) => ({
  id: c.id,
  name: c.name,
  count: c.count,
  icon: c.icon,
}));

function tokenize(...parts: Array<string | undefined>): string[] {
  const text = parts.filter((part): part is string => !!part).join(' ').toLowerCase();
  const tokens = text.split(/[^a-z0-9]+/).filter(Boolean);
  return Array.from(new Set(tokens));
}

function fromProduct(p: Product): CatalogEntry {
  return {
    id: p.id,
    app: p.app,
    category: p.category,
    name: p.name,
    searchTokens: tokenize(p.name, p.desc, p.category, p.shop),
    price: p.price,
    originalPrice: p.originalPrice,
    rating: p.rating,
    emoji: p.emoji,
    image: p.image,
    desc: p.desc,
    badge: p.badge,
    shop: p.shop,
    reviewsCount: p.reviewsCount,
    unit: p.unit,
    attributes: p.attributes,
  };
}

function fromNearbyOffer(offer: NearbyOffer): CatalogEntry {
  const entry = fromProduct(offer);
  return {
    ...entry,
    attributes: { ...(entry.attributes ?? {}), distance: offer.distance },
  };
}

function fromExploreItem(item: ExploreItem, stack: ExploreStack): CatalogEntry {
  const desc = `Featured pick from ${item.shop}`;
  return {
    id: item.id,
    app: stack.type,
    category: stack.title,
    name: item.name,
    searchTokens: tokenize(item.name, desc, stack.title, item.shop),
    price: item.price,
    rating: Number(item.rating),
    emoji: item.emoji,
    image: item.img,
    desc,
    shop: item.shop,
  };
}

function fromBookingDish(dish: BookingDish): CatalogEntry {
  const price = Number(dish.price.replace(/[^0-9.]/g, ''));
  const desc = `${dish.tags} · ${dish.restaurant}`;
  const category = 'Dining Reservations';
  return {
    id: dish.id,
    app: 'FOOD',
    category,
    name: dish.name,
    searchTokens: tokenize(dish.name, desc, category, dish.restaurant, dish.category),
    price,
    rating: Number(dish.rating),
    emoji: dish.emoji,
    image: dish.image,
    desc,
    shop: dish.restaurant,
    attributes: {
      kind: 'booking',
      tab: dish.tab,
      dishCategory: dish.category,
      isSpecial: dish.isSpecial ? 'true' : 'false',
    },
  };
}

const allEntries: CatalogEntry[] = [
  ...martProducts.map(fromProduct),
  ...MART_DEALS.map(dealToProduct).map(fromProduct),
  ...groceryProducts.map(fromProduct),
  ...foodProducts.map(fromProduct),
  ...TODAYS_SPECIALS.map(dishToProduct).map(fromProduct),
  ...BOOKING_DISHES_DB.map(fromBookingDish),
  ...pharmaProducts.map(fromProduct),
  ...mensPicks.map(fromProduct),
  ...womensPicks.map(fromProduct),
  ...childrensPicks.map(fromProduct),
  ...hairSkinPicks.map(fromProduct),
  ...instantFeed.map(fromProduct),
  ...recentlyViewedMart.map(fromProduct),
  ...recentlyViewedFood.map(fromProduct),
  ...recentlyViewedGrocery.map(fromProduct),
  ...recentlyViewedPharma.map(fromProduct),
  ...hotBrandDeals.map(fromProduct),
  ...nearbyOffers.map(fromNearbyOffer),
  ...exploreStacks.flatMap((stack) => stack.items.map((item) => fromExploreItem(item, stack))),
  ...Object.values(categoriesSearchDatabase).flat().map(fromProduct),
];

const seenIds = new Set<string>();
export const catalogIndex: CatalogEntry[] = [];
for (const entry of allEntries) {
  if (seenIds.has(entry.id)) continue;
  seenIds.add(entry.id);
  catalogIndex.push(entry);
}

export function getCatalogEntryById(id: string): CatalogEntry | undefined {
  return catalogIndex.find((e) => e.id === id);
}

export function getCatalogEntriesByIds(ids: string[]): CatalogEntry[] {
  return ids.map(getCatalogEntryById).filter((e): e is CatalogEntry => !!e);
}
