import { create } from 'zustand';

/** Surfaces that share a pull-to-refresh signal across sibling components. */
export type RefreshKey = 'home' | 'mart';

interface RefreshState {
  /** Incremented by a pull on the Home body; read by the Home feed + header rail. */
  home: number;
  /** Incremented by a pull on the Mart body; read by the Mart feed + header rail. */
  mart: number;
  /** Signal every reader of `key` to re-run its read. */
  bump: (key: RefreshKey) => void;
}

/**
 * Cross-component refresh signal. The body and its header rail are siblings in
 * the collapsing Home header, so a pull on the body cannot reach the rail by
 * props. A counter is the lightest shared signal: readers derive a reload key
 * from it, and one bump refreshes both. Session-scoped, never persisted.
 */
export const useRefreshStore = create<RefreshState>()((set) => ({
  home: 0,
  mart: 0,
  bump: (key) =>
    set((state) => ({ [key]: state[key] + 1 } as Pick<RefreshState, RefreshKey>)),
}));
