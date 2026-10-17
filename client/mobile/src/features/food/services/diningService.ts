import { gateway, type Venue } from '@/services/api/GatewayClient';
import type { SduiBanner, SduiSection } from '@data/home/sdui';
import { TOP_RATED_RESTAURANTS, DINING_RESTAURANTS } from '../mocks/restaurants';
import { TODAYS_SPECIALS } from '../mocks/specials';
import { TOP_FOODS_TO_ORDER } from '../mocks/homeFeed';
import type { FoodType } from '../mocks/homeFeed';
import type { DiningRestaurant, SpecialDish } from '../mocks/types';

export interface DiningFeed {
  topRated: DiningRestaurant[];
  specials: SpecialDish[];
  dining: DiningRestaurant[];
  topFoods: FoodType[];
  /** Editorial house hero (`foodHero.banners` from `GET /sdui/food`); paid FOOD_HERO renders first. */
  heroBanners: SduiBanner[];
}

/** One compiled Food SDUI section (ID-only leaf + joined rows). */
type FoodFeedSection = SduiSection & {
  products: unknown[];
  stores?: { id: string }[];
};

/**
 * Build a `DiningRestaurant` for a venue the fixture does not cover. The durable
 * `directory.dining_venues` projection carries only the public catalog fields
 * (rating/cover/categories), so the presentation-only fields (distance,
 * price-for-two, neighbourhood, geo) fall back to neutral values. Seeded venues
 * keep their richer fixture row by id (see `mergeDining`).
 */
function venueToRestaurant(v: Venue): DiningRestaurant {
  return {
    id: v.id,
    name: v.name,
    image: v.coverImage,
    rating: v.rating ?? 0,
    ratingCount: 0,
    distance: 0,
    deliveryTime: '',
    priceForTwo: 0,
    cuisine: v.categories.join(' • '),
    cuisines: v.categories,
    neighborhood: v.address ?? '',
    address: v.address ?? '',
    latitude: 0,
    longitude: 0,
    isFavourite: false,
    dietType: 'both',
  };
}

/**
 * Keep the grid's curated fixture order, drop venues the server no longer lists,
 * and append server venues the fixture does not know — enriching every known id
 * with its rich fixture row so the cards never lose distance/price-for-two copy.
 */
function mergeDining(fixture: DiningRestaurant[], venues: Venue[]): DiningRestaurant[] {
  const venueIds = new Set(venues.map((v) => v.id));
  const kept = fixture.filter((r) => venueIds.has(r.id));
  const known = new Set([...fixture, ...TOP_RATED_RESTAURANTS].map((r) => r.id));
  const extras = venues.filter((v) => !known.has(v.id)).map(venueToRestaurant);
  return [...kept, ...extras];
}

/** Reorder `restaurants` so the SDUI store-id list leads (ids with no matching row are ignored);
 *  the remaining rows keep their curated fixture order. Empty list → untouched. */
function orderByStoreIds(restaurants: DiningRestaurant[], ids: string[]): DiningRestaurant[] {
  if (ids.length === 0) return restaurants;
  const byId = new Map(restaurants.map((r) => [r.id, r]));
  const ordered: DiningRestaurant[] = [];
  for (const id of ids) {
    const r = byId.get(id);
    if (r) {
      ordered.push(r);
      byId.delete(id);
    }
  }
  return [...ordered, ...byId.values()];
}

/**
 * Dining-first home feed. The dining grid is driven by the durable
 * `directory.dining_venues` list (`GET /venues?app=FOOD`) through
 * `GatewayClient.getVenues`; a network/HTTP error falls back to the `@data`
 * identity table and an empty result keeps the feature fixtures so the grid is
 * never blank. The house hero banners come from the Food-only SDUI projection
 * (`GET /sdui/food` → `foodHero`), and the Top Rated carousel drops venues the
 * server no longer lists (so a delisted `tr-*` row never opens a stale profile).
 * The curated specials and mind/snack rails stay fixture-owned (Today's Special
 * order is not yet SDUI-driven).
 */
export async function fetchDiningFeed(): Promise<DiningFeed> {
  // Independent legs — one failing route never blanks the whole feed (Mart W43 pattern).
  const [venues, food] = await Promise.all([
    gateway.getVenues('FOOD').catch(() => [] as Venue[]),
    gateway.getFoodFeed().catch(() => [] as FoodFeedSection[]),
  ]);

  const venueIds = new Set(venues.map((v) => v.id));
  const liveTopRated =
    venues.length > 0 ? TOP_RATED_RESTAURANTS.filter((r) => venueIds.has(r.id)) : TOP_RATED_RESTAURANTS;

  const hero = food.find((s) => (s.id as string) === 'foodHero');
  const mostRated = food.find((s) => (s.id as string) === 'mostRatedDining');

  return {
    topRated: orderByStoreIds(liveTopRated, mostRated?.stores?.map((s) => s.id) ?? []),
    specials: TODAYS_SPECIALS,
    dining: venues.length > 0 ? mergeDining(DINING_RESTAURANTS, venues) : DINING_RESTAURANTS,
    topFoods: TOP_FOODS_TO_ORDER,
    heroBanners: hero?.banners ?? [],
  };
}