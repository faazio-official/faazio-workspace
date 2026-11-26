import { create } from 'zustand';

export type DietFilter = 'all' | 'veg' | 'nonveg';

interface FoodFilterState {
  /** Zomato-style diet filter shared across all Food sub-app screens + search. */
  dietFilter: DietFilter;
  setDietFilter: (filter: DietFilter) => void;
  /** Only restaurants that accept scheduled / pre-orders (0142). */
  scheduleOnly: boolean;
  setScheduleOnly: (value: boolean) => void;
}

/**
 * Single source of truth for the Food sub-app Veg / Non-Veg filter. Session-
 * scoped (no persistence): a diet filter is ephemeral context, and silently
 * filtering content on next launch would be dishonest.
 */
export const useFoodFilterStore = create<FoodFilterState>()((set) => ({
  dietFilter: 'all',
  setDietFilter: (dietFilter) => set({ dietFilter }),
  scheduleOnly: false,
  setScheduleOnly: (scheduleOnly) => set({ scheduleOnly }),
}));
