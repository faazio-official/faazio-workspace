import { create } from 'zustand';

export type DietFilter = 'all' | 'veg' | 'nonveg';

interface FoodFilterState {
  /** Zomato-style diet filter shared across all Food sub-app screens + search. */
  dietFilter: DietFilter;
  setDietFilter: (filter: DietFilter) => void;
}

/**
 * Single source of truth for the Food sub-app Veg / Non-Veg filter. Session-
 * scoped (no persistence): a diet filter is ephemeral context, and silently
 * filtering content on next launch would be dishonest.
 */
export const useFoodFilterStore = create<FoodFilterState>()((set) => ({
  dietFilter: 'all',
  setDietFilter: (dietFilter) => set({ dietFilter }),
}));
