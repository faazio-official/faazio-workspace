import type { ComponentType, ReactElement } from 'react';
import type { Product } from '@data/types';
import type { SearchSuggestion } from './suggestions';

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

/**
 * One facetable attribute column. Mirrors Algolia/Typesense facet definitions:
 * the schema always declares a key (product attribute name) + label, never the
 * option values — options are derived from the matched result set at runtime
 * via useFacets.
 */
export interface FacetSchema {
  key: string;
  label: string;
  multiSelect?: boolean;
}

/** A single facet option with its live count across the matched result set. */
export interface FacetOption {
  value: string;
  label: string;
  count: number;
}

/** A facet group (attribute) with its derived option counts. */
export interface FacetGroup {
  key: string;
  label: string;
  options: FacetOption[];
  multiSelect: boolean;
}

/** Active facet selection: facet key → selected option values. */
export type ActiveFacets = Record<string, string[]>;

export interface SearchModeConfig<TItem> {
  key: string;
  data: TItem[];
  /** Renders one result. `index` is the flat list index, used to derive the grid column for the 2-column layout. */
  renderCard: (item: TItem, index: number) => ReactElement | null;
  /**
   * Returns true when the item should remain visible given the current free-text
   * query, the set of active filter chip ids, and the active facet selections
   * (facet key → selected option values).
   */
  predicate: (
    item: TItem,
    query: string,
    activeFilterIds: string[],
    activeFacets: ActiveFacets,
  ) => boolean;
  /** Map of sort-option id → comparator. Applied after predicate filtering. */
  sorters: Record<string, (a: TItem, b: TItem) => number>;
  /** Empty-state content rendered when the filtered list is empty. */
  empty?: ReactElement;
}

export interface SearchScreenConfig {
  searchPlaceholder?: string;
  toggles: SearchToggleOption[];
  /**
   * When false the shell hides the segmented toggle rail and shows the first
   * mode. Used for redundant toggle sets: single-option "Products"/"Medicines"
   * controls and the cross-app "All/Mart/Grocery/Pharma" filter (which would
   * otherwise force a manual per-app choice when the scope is already known).
   * Defaults to true; Food's genuine Restaurants/Dishes toggle keeps it.
   */
  showToggles?: boolean;
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
  /**
   * Number of columns for the results FlatList. Defaults to 1 (single column,
   * one full-width row per item). Set to 2 for a two-column product grid where
   * each card renders at half width. Food's row-layout search cards keep the
   * default single column.
   */
  numColumns?: 1 | 2;
  /** Rendering key used by FlatList. Defaults to the item id. */
  keyFor?: (item: any, index: number) => string;
  /**
   * Optional facet schema. When present the shell switches to facet mode: it
   * renders a Filter + sort bar (instead of the boolean chip rail) and opens a
   * facet overlay sheet. Facet option counts are always derived from the matched
   * result set's attributes — never hand-mapped per keyword.
   */
  facetSchema?: FacetSchema[];
  /**
   * Optional Flipkart-style type-ahead engine. When present, the shell replaces
   * everything below the header with a suggestion list while the user types but
   * has not yet committed. Receives the active mode's data + the current query
   * and returns ranked `SearchSuggestion`s. Absent → results render as today.
   * Product sub-apps use `buildProductSuggestions`; Food is deferred.
   */
  buildSuggestions?: (products: Product[], query: string) => SearchSuggestion[];
}
