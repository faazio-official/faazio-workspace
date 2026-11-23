import { create } from 'zustand';
import type { SavedAddress } from '@data/types';
import { gateway } from '@/services/api/GatewayClient';

/**
 * The caller's saved addresses, cached in one place.
 *
 * Why a store rather than per-screen state: proximity auto-select runs from the location poller,
 * which has no screen. It needs the saved list to answer "is the user standing in one of these?"
 * without a network round-trip on every fix. The list is server-owned (there is no local seed); this
 * only caches the last successful read and is refreshed on focus by the screens that show it.
 *
 * Matching itself lives in `utils/addressProximity` so it stays pure and testable.
 */

interface AddressesState {
  addresses: SavedAddress[];
  /** True once a successful server read has landed (an empty list is a valid result). */
  loaded: boolean;
  refresh: () => Promise<void>;
  /** Replace the cache after a screen writes (avoids a second round-trip). */
  setAddresses: (rows: SavedAddress[]) => void;
  reset: () => void;
}

export const useAddressesStore = create<AddressesState>()((set) => ({
  addresses: [],
  loaded: false,

  refresh: async () => {
    try {
      const rows = await gateway.getAddresses();
      set({ addresses: rows, loaded: true });
    } catch {
      // Offline: keep whatever we had. A stale list is still better than no proximity matching,
      // and nothing here is presented as live server state.
    }
  },

  setAddresses: (rows) => set({ addresses: rows, loaded: true }),

  reset: () => set({ addresses: [], loaded: false }),
}));
