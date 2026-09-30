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
}

/**
 * Venues that exist only in the feature dining mocks (hero carousel + dining
 * grid). Ids/names mirror `features/food/mocks/restaurants.ts` exactly.
 */
const MOCK_DINING_VENUES: DiningVenue[] = [
  { id: 'tr-1', name: 'Skyline Bistro' },
  { id: 'tr-2', name: 'The Spice Room' },
  { id: 'tr-3', name: 'Olive Cafe' },
  { id: 'tr-4', name: 'Copper Chimney' },
  { id: 'tr-5', name: 'The Coastal House' },
  { id: 'tr-6', name: 'Veranda Dining' },
  { id: 'dn-1', name: 'Sea Salt Grill' },
  { id: 'dn-2', name: 'Green Leaf Bistro' },
  { id: 'dn-3', name: 'Morningside Diner' },
  { id: 'dn-4', name: 'The Brass Monkey' },
  { id: 'dn-5', name: 'Terraza Latina' },
  { id: 'dn-6', name: 'Naan & Kebab Junction' },
  { id: 'dn-7', name: 'Cafe Corretto' },
  { id: 'dn-8', name: 'The Garden Table' },
  { id: 'dn-9', name: 'Lotus & Lantern' },
  { id: 'dn-10', name: 'The Irish Anchor' },
  { id: 'dn-11', name: 'Dakshin Swad' },
  { id: 'dn-12', name: 'Biryani Basera' },
];

/** All dining venues, deduped by id (food stores first, then mock-only venues). */
export const diningVenues: DiningVenue[] = [
  ...foodStores.map((store) => ({ id: store.id, name: store.name })),
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
