import { gateway, type Venue, type ProductView } from '@/services/api/GatewayClient';
import type { SduiBanner, SduiSection } from '@data/home/sdui';
import type { FoodType, FoodRestaurant } from '../types';
import type { SpecialDish } from '@data/types';

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
  /** True when the Food SDUI feed answered, so an empty `specials`/`topFoods` rail is authoritative. */
  feedAuthoritative: boolean;
}

/** One compiled Food SDUI section (ID-only leaf + joined rows). */
type FoodFeedSection = SduiSection & {
  products: ProductView[];
  stores?: { id: string }[];
};

/** Map a server catalog row to the Food specials rail model (server money/image wins). */
function productToDish(p: ProductView): SpecialDish {
  const dietary = String(p.attributes?.dietary ?? '');
  return {
    id: p.id,
    dishName: p.name,
    restaurant: p.shop ?? '',
    price: p.price,
    mrp: p.originalPrice,
    image: p.image,
    isVeg: !/non-?veg/i.test(dietary),
    description: p.desc,
    rating: p.rating,
  };
}

/**
 * Build a `FoodRestaurant` for a venue. The durable `directory.dining_venues` projection carries
 * only the public catalog fields (rating/cover/categories), so the presentation-only fields
 * (distance, price-for-two, neighbourhood, geo) are neutral unless the server supplies them.
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
 * Food-first home feed. Online, every rail is server-derived:
 * - the restaurant grid from the authoritative `GET /venues?app=FOOD` list,
 * - "Today's Special" from the `foodSpecials` joined products,
 * - the hero from `foodHero`,
 * - Top Rated from the curated `mostRatedVenues` ids resolved against the server venue list.
 * A network/HTTP error leaves the affected rail empty (honest empty state) — there is no bundled
 * fixture to substitute while the gateway is enabled. When the gateway is disabled the feed is
 * empty (offline shell) rather than a bundled demo catalog.
 */
export async function fetchRestaurantFeed(): Promise<RestaurantFeed> {
  const offline = !gateway.remoteEnabled;
  if (offline) {
    return {
      topRated: [],
      specials: [],
      restaurants: [],
      topFoods: [],
      heroBanners: [],
      venueAuthoritative: false,
      feedAuthoritative: false,
    };
  }

  // Independent legs — one failing route never blanks the whole feed (Mart W43 pattern).
  const foodLeg = gateway.getFoodFeed().catch(() => null);

  let venues: Venue[] = [];
  let venueAuthoritative = false;
  try {
    venues = await gateway.fetchVenues('FOOD');
    venueAuthoritative = true;
  } catch {
    // Offline / HTTP error: the grid is empty — never a stale fixture pretending to be live.
    venues = [];
  }

  const food = await foodLeg;
  const feedAuthoritative = food !== null;
  const foodFeed = food ?? [];

  const hero = foodFeed.find((s) => (s.id as string) === 'foodHero');
  const specials = foodFeed.find((s) => (s.id as string) === 'foodSpecials');
  // Curated dining-venue order lives on `mostRatedVenues` (directory.dining_venues ids). Fall back
  // to the legacy `mostRatedDining` id for an older published doc; either way curation is a no-op
  // on ids that are not real venues (the rail then falls back to server rating order below).
  const mostRated =
    foodFeed.find((s) => (s.id as string) === 'mostRatedVenues') ??
    foodFeed.find((s) => (s.id as string) === 'mostRatedDining');

  const venueById = new Map(venues.map((v) => [v.id, v]));
  const curatedIds = mostRated?.storeIds ?? mostRated?.stores?.map((s) => s.id) ?? [];

  // Top Rated: the curated ids resolved against the authoritative venue list; when the doc does
  // not curate, fall back to the server's rating order (never to bundled fixture-only venues).
  const curatedTop = curatedIds
    .map((id) => venueById.get(id))
    .filter((v): v is Venue => Boolean(v));
  const topVenues =
    curatedTop.length > 0
      ? curatedTop
      : [...venues].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 6);

  // Specials: the server-joined `foodSpecials` rows (money/image/rating from the gateway). An
  // empty join is an honest empty rail online, never an authored fixture list.
  const specialDishes = feedAuthoritative
    ? (specials?.products ?? []).map(productToDish)
    : [];

  if (__DEV__ && curatedIds.length > 0) {
    const known = new Set(venues.map((v) => v.id));
    const unresolved = curatedIds.filter((id) => !known.has(id));
    if (unresolved.length > 0) {
      console.warn('[food] mostRatedVenues storeIds unresolved (curation no-op):', unresolved);
    }
  }

  return {
    topRated: topVenues.map(venueToRestaurant),
    specials: specialDishes,
    restaurants: venues.map(venueToRestaurant),
    // There is no server-backed category/snack feed yet: an online rail is an honest empty.
    topFoods: [],
    heroBanners: feedAuthoritative ? hero?.banners ?? [] : [],
    venueAuthoritative,
    feedAuthoritative,
  };
}