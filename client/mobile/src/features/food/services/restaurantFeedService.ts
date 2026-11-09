import { gateway, type Venue, type ProductView } from '@/services/api/GatewayClient';
import type { StoreRecord } from '@data/directory/stores';
import type { SduiBanner, SduiSection } from '@data/home/sdui';
import type { FoodType, FoodRestaurant } from '../types';
import type { SpecialDish } from '@data/types';

export interface RestaurantFeed {
  specials: SpecialDish[];
  restaurants: FoodRestaurant[];
  topFoods: FoodType[];
  /** Editorial house hero (`foodHero.banners` from `GET /sdui/food`); paid FOOD_HERO renders first. */
  heroBanners: SduiBanner[];
  /**
   * True when the vendor list — the union of seller-owned FOOD delivery kitchens (`directory.stores`,
   * server-side `is_live`-filtered) and dining venues (`directory.dining_venues`) — came back from
   * the authoritative server (even when empty). False when a read failed / offline. When true, the
   * screen must NOT fall back to fixture venues on an empty list — an all-delisted/state-filtered
   * catalog should show an honest empty state, not stale restaurants that open dead profiles.
   */
  vendorsAuthoritative: boolean;
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
 * Build a `FoodRestaurant` for a seller-owned FOOD `directory.stores` vendor (delivery kitchen).
 * These carry the real rating/cover/categories/geo the dining-venue stubs lack. The store id is also
 * a valid `directory.menus.venue_id`, so the menu resolves through `GET /venues/{id}/menu`.
 */
export function storeToRestaurant(s: StoreRecord): FoodRestaurant {
  const parsedDistance = s.distanceKm ?? parseFloat(s.distance);
  return {
    id: s.id,
    name: s.name,
    image: s.coverImage,
    rating: s.rating ?? 0,
    ratingCount: s.reviewsCount ?? 0,
    distance: Number.isFinite(parsedDistance) ? parsedDistance : 0,
    priceForTwo: 0,
    cuisine: s.categories.join(' • '),
    cuisines: s.categories,
    neighborhood: s.address ?? '',
    offerTag: s.offerTag,
    address: s.address ?? '',
    latitude: s.latitude ?? 0,
    longitude: s.longitude ?? 0,
    isFavourite: false,
    dietType: s.isVeg === undefined ? 'both' : s.isVeg ? 'veg' : 'nonveg',
  };
}

/**
 * Food-first home feed. Online, every rail is server-derived:
 * - the restaurant grid from the union of the authoritative `GET /stores?app=FOOD` (seller-owned
 *   delivery kitchens, `is_live`-filtered server-side) and `GET /venues?app=FOOD` lists,
 * - "Today's Special" from the `foodSpecials` joined products,
 * - the hero from `foodHero`.
 * The two vendor id spaces (`store-f*` stores and `tr-*`/`dn-*` dining venues) are disjoint, so the
 * grid is their de-duplicated union, richest (rating) first. A network/HTTP error leaves the
 * affected read out (honest empty state) — there is no bundled fixture to substitute while the
 * gateway is enabled. When the gateway is disabled the feed is empty (offline shell) rather than a
 * bundled demo catalog.
 */
export async function fetchRestaurantFeed(): Promise<RestaurantFeed> {
  const offline = !gateway.remoteEnabled;
  if (offline) {
    return {
      specials: [],
      restaurants: [],
      topFoods: [],
      heroBanners: [],
      vendorsAuthoritative: false,
      feedAuthoritative: false,
    };
  }

  // Independent legs — one failing route never blanks the whole feed (Mart W43 pattern).
  const foodLeg = gateway.getFoodFeed().catch(() => null);

  let stores: StoreRecord[] = [];
  let venues: Venue[] = [];
  let storesAuthoritative = false;
  let venuesAuthoritative = false;
  await Promise.all([
    gateway
      .fetchStores('FOOD')
      .then((rows) => {
        stores = rows;
        storesAuthoritative = true;
      })
      .catch(() => {
        // Server-only read failed: drop the store half, never a stale fixture.
      }),
    gateway
      .fetchVenues('FOOD')
      .then((rows) => {
        venues = rows;
        venuesAuthoritative = true;
      })
      .catch(() => {
        // Server-only read failed: drop the venue half, never a stale fixture.
      }),
  ]);

  const food = await foodLeg;
  const feedAuthoritative = food !== null;
  const foodFeed = food ?? [];

  const hero = foodFeed.find((s) => (s.id as string) === 'foodHero');
  const specials = foodFeed.find((s) => (s.id as string) === 'foodSpecials');

  // Vendor union: seller-owned FOOD stores first (they carry the rich presentation data), then the
  // dining venues, de-duplicated by id and ordered by rating (null/0 last), then name.
  const seen = new Set<string>();
  const vendors: FoodRestaurant[] = [];
  for (const s of stores) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    vendors.push(storeToRestaurant(s));
  }
  for (const v of venues) {
    if (seen.has(v.id)) continue;
    seen.add(v.id);
    vendors.push(venueToRestaurant(v));
  }
  vendors.sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));

  // Specials: the server-joined `foodSpecials` rows (money/image/rating from the gateway). An
  // empty join is an honest empty rail online, never an authored fixture list.
  const specialDishes = feedAuthoritative
    ? (specials?.products ?? []).map(productToDish)
    : [];

  return {
    specials: specialDishes,
    restaurants: vendors,
    // There is no server-backed category/snack feed yet: an online rail is an honest empty.
    topFoods: [],
    heroBanners: feedAuthoritative ? hero?.banners ?? [] : [],
    vendorsAuthoritative: storesAuthoritative && venuesAuthoritative,
    feedAuthoritative,
  };
}
