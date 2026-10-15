import { gateway, type Venue } from '@/services/api/GatewayClient';
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
}

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

/**
 * Dining-first home feed. The dining grid is driven by the durable
 * `directory.dining_venues` list (`GET /venues?app=FOOD`) through
 * `GatewayClient.getVenues`; a network/HTTP error falls back to the `@data`
 * identity table and an empty result keeps the feature fixtures so the grid is
 * never blank. The curated hero carousel, specials and mind/snack rails stay
 * fixture-owned until their own contract deltas land.
 */
export async function fetchDiningFeed(): Promise<DiningFeed> {
  const venues = await gateway.getVenues('FOOD').catch(() => [] as Venue[]);
  const dining = venues.length > 0 ? mergeDining(DINING_RESTAURANTS, venues) : DINING_RESTAURANTS;
  return {
    topRated: TOP_RATED_RESTAURANTS,
    specials: TODAYS_SPECIALS,
    dining,
    topFoods: TOP_FOODS_TO_ORDER,
  };
}