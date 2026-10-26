import { gateway, type Venue } from '@/services/api/GatewayClient';
import type { SduiBanner, SduiSection } from '@data/home/sdui';
import { TOP_RATED_RESTAURANTS, FOOD_RESTAURANTS } from '../mocks/restaurants';
import { TODAYS_SPECIALS } from '../mocks/specials';
import { TOP_FOODS_TO_ORDER } from '../mocks/homeFeed';
import type { FoodType } from '../mocks/homeFeed';
import type { FoodRestaurant, SpecialDish } from '../mocks/types';

export interface RestaurantFeed {
  topRated: FoodRestaurant[];
  specials: SpecialDish[];
  restaurants: FoodRestaurant[];
  topFoods: FoodType[];
  /** Editorial house hero (`foodHero.banners` from `GET /sdui/food`); paid FOOD_HERO renders first. */
  heroBanners: SduiBanner[];
  /**
   * True when the venue list is the authoritative server result (even when empty), false when it
   * is the offline fixture. When true, the screen must NOT fall back to fixture venues on an
   * empty list — an all-delisted/state-filtered catalog should show an honest empty state, not
   * stale restaurants that open dead profiles.
   */
  venueAuthoritative: boolean;
}

/** One compiled Food SDUI section (ID-only leaf + joined rows). */
type FoodFeedSection = SduiSection & {
  products: unknown[];
  stores?: { id: string }[];
};

/**
 * Build a `FoodRestaurant` for a venue the fixture does not cover. The durable
 * `directory.dining_venues` projection carries only the public catalog fields
 * (rating/cover/categories), so the presentation-only fields (distance,
 * price-for-two, neighbourhood, geo) fall back to neutral values. Seeded venues
 * keep their richer fixture row by id (see `mergeVenues`).
 */
function venueToRestaurant(v: Venue): FoodRestaurant {
  return {
    id: v.id,
    name: v.name,
    image: v.coverImage,
    rating: v.rating ?? 0,
    ratingCount: 0,
    distance: v.distanceKm ?? 0,
    priceForTwo: 0,
    cuisine: v.categories.join(' • '),
    cuisines: v.categories,
    neighborhood: v.address ?? '',
    address: v.address ?? '',
    latitude: v.latitude ?? 0,
    longitude: v.longitude ?? 0,
    isFavourite: false,
    dietType: 'both',
  };
}

/**
 * Keep the grid's curated fixture order, drop venues the server no longer lists,
 * and append server venues the fixture does not know — enriching every known id
 * with its rich fixture row so the cards never lose distance/price-for-two copy.
 */
function mergeVenues(fixture: FoodRestaurant[], venues: Venue[]): FoodRestaurant[] {
  const venueIds = new Set(venues.map((v) => v.id));
  const kept = fixture.filter((r) => venueIds.has(r.id));
  const known = new Set([...fixture, ...TOP_RATED_RESTAURANTS].map((r) => r.id));
  const extras = venues.filter((v) => !known.has(v.id)).map(venueToRestaurant);
  return [...kept, ...extras];
}

/** Reorder `restaurants` so the SDUI store-id list leads (restaurant `tr-*` ids; ids with no
 *  matching row are ignored); the remaining rows keep their curated fixture order. Empty list →
 *  untouched. Reads the raw `storeIds` (restaurants the server's store join cannot resolve), not
 *  the joined `stores` array, so the curation is not a silent no-op. */
function orderByStoreIds(restaurants: FoodRestaurant[], ids: string[]): FoodRestaurant[] {
  if (ids.length === 0) return restaurants;
  const byId = new Map(restaurants.map((r) => [r.id, r]));
  const ordered: FoodRestaurant[] = [];
  for (const id of ids) {
    const r = byId.get(id);
    if (r) {
      ordered.push(r);
      byId.delete(id);
    }
  }
  return [...ordered, ...byId.values()];
}

/** Reorder `specials` so the SDUI dish-id list leads (ids with no matching dish are ignored); the
 *  remaining dishes keep their curated fixture order. Empty list → untouched, so an uncurated or
 *  offline doc never blanks the rail. */
function orderByDishIds(specials: SpecialDish[], ids: string[]): SpecialDish[] {
  if (ids.length === 0) return specials;
  const byId = new Map(specials.map((d) => [d.id, d]));
  const ordered: SpecialDish[] = [];
  for (const id of ids) {
    const d = byId.get(id);
    if (d) {
      ordered.push(d);
      byId.delete(id);
    }
  }
  return [...ordered, ...byId.values()];
}

/**
 * Food-first home feed. The restaurant grid is driven by the durable
 * `directory.dining_venues` list (`GET /venues?app=FOOD`) through the server-only
 * `GatewayClient.fetchVenues`; only a network/HTTP error falls back to the `@data`
 * identity table and the feature fixtures — an authoritative empty result is
 * respected (the screen shows an honest empty state, so delisted venues never
 * linger as stale profiles). The house hero banners come from the Food-only SDUI
 * projection (`GET /sdui/food` → `foodHero`), the "Today's Special" rail order from
 * `foodSpecials`, and the Top Rated carousel drops venues the server no longer
 * lists. The curated mind/snack rails stay fixture-owned.
 */
export async function fetchRestaurantFeed(): Promise<RestaurantFeed> {
  // Independent legs — one failing route never blanks the whole feed (Mart W43 pattern).
  const foodLeg = gateway.getFoodFeed().catch(() => [] as FoodFeedSection[]);

  let venues: Venue[] = [];
  let venueAuthoritative = false;
  try {
    venues = await gateway.fetchVenues('FOOD');
    venueAuthoritative = true;
  } catch {
    // Offline / HTTP error: keep the fixture grid so the feed is never blank.
    venues = [];
  }

  const food = await foodLeg;

  const venueIds = new Set(venues.map((v) => v.id));
  // Authoritative empty → drop fixture venues that the server no longer lists (empty carousel).
  // Offline (fixture fallback) → keep the curated fixture carousel untouched.
  const liveTopRated = venueAuthoritative
    ? TOP_RATED_RESTAURANTS.filter((r) => venueIds.has(r.id))
    : TOP_RATED_RESTAURANTS;

  const hero = food.find((s) => (s.id as string) === 'foodHero');
  const specials = food.find((s) => (s.id as string) === 'foodSpecials');
  const mostRated = food.find((s) => (s.id as string) === 'mostRatedDining');

  // `mostRatedDining` is an ID-only contract: the client reads the raw `storeIds` (the server's
  // store join cannot resolve restaurant `tr-*` ids). A typo or a wrong id-space (`store-f*`)
  // silently no-ops there, so surface it in dev rather than letting the curation vanish.
  const curatedIds = mostRated?.storeIds ?? mostRated?.stores?.map((s) => s.id) ?? [];
  if (__DEV__ && curatedIds.length > 0) {
    const known = new Set([
      ...TOP_RATED_RESTAURANTS.map((r) => r.id),
      ...FOOD_RESTAURANTS.map((r) => r.id),
      ...venueIds,
    ]);
    const unresolved = curatedIds.filter((id) => !known.has(id));
    if (unresolved.length > 0) {
      console.warn('[food] mostRatedDining storeIds unresolved (curation no-op):', unresolved);
    }
  }

  return {
    topRated: orderByStoreIds(liveTopRated, curatedIds),
    specials: orderByDishIds(TODAYS_SPECIALS, specials?.productIds ?? []),
    restaurants: venueAuthoritative ? mergeVenues(FOOD_RESTAURANTS, venues) : FOOD_RESTAURANTS,
    topFoods: TOP_FOODS_TO_ORDER,
    heroBanners: hero?.banners ?? [],
    venueAuthoritative,
  };
}
