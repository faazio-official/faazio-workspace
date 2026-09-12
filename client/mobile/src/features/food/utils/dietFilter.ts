import type { DietFilter } from '@/state/foodFilterStore';

/**
 * Pure, unit-testable diet-filter semantics for the Food sub-app.
 *
 * Venues (`dietType: 'veg' | 'nonveg' | 'both'`):
 *   - VEG keeps `veg + both` · NONVEG keeps `nonveg + both`
 *   - Only pure-veg venues drop in Non-Veg mode and pure-non-veg venues drop in
 *     Veg mode.
 *
 * Dishes (`isVeg?: boolean`):
 *   - VEG keeps only `true` · NONVEG keeps only `false`
 *   - `undefined` (unclassifiable) hides under any active filter.
 */

/** Venue diet classification. */
export type VenueDiet = 'veg' | 'nonveg' | 'both';

export interface VenueLike {
  dietType?: VenueDiet;
}

export interface DishLike {
  isVeg?: boolean;
}

/** Does a venue stay visible under the active filter? */
export function venueMatches(filter: DietFilter, venue: VenueLike): boolean {
  if (filter === 'all') return true;
  const t = venue.dietType;
  if (!t) return true; // unclassified venues are never filtered out
  if (t === 'both') return true;
  return t === filter;
}

/** Does a dish stay visible under the active filter? */
export function dishMatches(filter: DietFilter, dish: DishLike): boolean {
  if (filter === 'all') return true;
  if (dish.isVeg === undefined) return false; // unclassifiable hides under a filter
  return dish.isVeg ? filter === 'veg' : filter === 'nonveg';
}
