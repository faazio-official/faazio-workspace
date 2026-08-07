import type { ComponentType, ReactElement } from 'react';

/**
 * Shared search screen types. The screen shell (SearchScreen) is app-agnostic:
 * each sub-app supplies its own toggles, filter chips, data, card renderer and
 * sort comparators through a SearchScreenConfig. See features/food for the
 * concrete Food sub-app wiring.
 */

export interface SearchToggleOption {
  key: string;
  label: string;
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}

export interface SearchFilterChip {
  id: string;
  label: string;
  icon?: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  /** Renders the vertical divider used by the leading "Sort by" dropdown pill. */
  showDivider?: boolean;
}

export interface SortOption {
  id: string;
  label: string;
}

export interface SearchModeConfig<TItem> {
  key: string;
  data: TItem[];
  renderCard: (item: TItem) => ReactElement | null;
  /**
   * Returns true when the item should remain visible given the current free-text
   * query and the set of active filter chip ids.
   */
  predicate: (item: TItem, query: string, activeFilterIds: string[]) => boolean;
  /** Map of sort-option id → comparator. Applied after predicate filtering. */
  sorters: Record<string, (a: TItem, b: TItem) => number>;
  /** Empty-state content rendered when the filtered list is empty. */
  empty?: ReactElement;
}

export interface SearchScreenConfig {
  title: string;
  searchPlaceholder?: string;
  toggles: SearchToggleOption[];
  filterChips: SearchFilterChip[];
  sortOptions: SortOption[];
  /**
   * Modes keyed by toggle key. The shell treats items as opaque and simply
   * passes them through to the mode's predicate / renderCard / sorters.
   */
  modes: Record<string, SearchModeConfig<any>>;
  /** Fixed content anchored above the bottom bar (e.g. floating cart bar). */
  bottomBar?: ReactElement;
  /** Brand accent used for active pill, links and icons. */
  accentColor?: string;
  /** Rendering key used by FlatList. Defaults to the item id. */
  keyFor?: (item: any, index: number) => string;
}
