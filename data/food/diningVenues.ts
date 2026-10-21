/**
 * @mock Dining-venue identity table (ids + names only). Mirrors the dining
 * restaurants surfaced by `features/food/mocks/restaurants.ts` plus the food
 * `StoreProfile`s in `data/food/stores.ts`, so the data layer can resolve a
 * food order's venue identity without importing feature code. Only identity is
 * held here — the full venue-data migration (rating, images, hours…) stays a
 * separate task. See data/DATA_CONTROL.md.
 */
import { foodStores } from './stores';

export interface DiningVenue {
  id: string;
  name: string;
  /** Venue location (public business data). */
  latitude?: number;
  longitude?: number;
}

/**
 * Venues that exist only in the feature dining mocks (hero carousel + dining
 * grid). Ids/names mirror `features/food/mocks/restaurants.ts` exactly.
 */
const MOCK_DINING_VENUES: DiningVenue[] = [
  { id: 'tr-1', name: 'Skyline Bistro', latitude: 17.422, longitude: 78.442 },
  { id: 'tr-2', name: 'The Spice Room', latitude: 17.4319, longitude: 78.414 },
  { id: 'tr-3', name: 'Olive Cafe', latitude: 17.4435, longitude: 78.3772 },
  { id: 'tr-4', name: 'Copper Chimney', latitude: 17.4156, longitude: 78.4348 },
  { id: 'tr-5', name: 'The Coastal House', latitude: 17.4287, longitude: 78.4041 },
  { id: 'tr-6', name: 'Veranda Dining', latitude: 17.4137, longitude: 78.4621 },
  { id: 'dn-1', name: 'Sea Salt Grill', latitude: 17.4435, longitude: 78.3772 },
  { id: 'dn-2', name: 'Green Leaf Bistro', latitude: 17.4496, longitude: 78.3914 },
  { id: 'dn-3', name: 'Morningside Diner', latitude: 17.448, longitude: 78.3868 },
  { id: 'dn-4', name: 'The Brass Monkey', latitude: 17.4435, longitude: 78.3772 },
  { id: 'dn-5', name: 'Terraza Latina', latitude: 17.4367, longitude: 78.3577 },
  { id: 'dn-6', name: 'Naan & Kebab Junction', latitude: 17.4849, longitude: 78.3993 },
  { id: 'dn-7', name: 'Cafe Corretto', latitude: 17.4258, longitude: 78.3697 },
  { id: 'dn-8', name: 'The Garden Table', latitude: 17.4415, longitude: 78.3813 },
  { id: 'dn-9', name: 'Lotus & Lantern', latitude: 17.4879, longitude: 78.3993 },
  { id: 'dn-10', name: 'The Irish Anchor', latitude: 17.4297, longitude: 78.4094 },
  { id: 'dn-11', name: 'Dakshin Swad', latitude: 17.4803, longitude: 78.3923 },
  { id: 'dn-12', name: 'Biryani Basera', latitude: 17.4419, longitude: 78.3806 },
];

/** All dining venues, deduped by id (food stores first, then mock-only venues). */
export const diningVenues: DiningVenue[] = [
  ...foodStores.map((store) => ({
    id: store.id,
    name: store.name,
    latitude: store.latitude,
    longitude: store.longitude,
  })),
  ...MOCK_DINING_VENUES,
];

export function getDiningVenueById(id: string): DiningVenue | undefined {
  return diningVenues.find((venue) => venue.id === id);
}

export function findDiningVenueByName(name?: string): DiningVenue | undefined {
  if (!name) return undefined;
  const normalized = name.trim().toLowerCase();
  return diningVenues.find((venue) => venue.name.trim().toLowerCase() === normalized);
}
