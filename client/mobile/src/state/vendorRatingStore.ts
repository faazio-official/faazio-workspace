import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'faazio/vendor-ratings/v1';

/** Max comment length for a vendor rating. */
export const MAX_VENDOR_RATING_COMMENT = 280;

/**
 * One live rating per (user, vendor) — revisiting the vendor updates the same
 * entry ("latest wins"). `orderIds` is verified-purchase provenance and is never
 * displayed or logged. Public display uses the reviewer name elsewhere; this row
 * holds no PII beyond the rating content.
 */
export interface UserVendorRating {
  vendorId: string;
  userId: string;
  rating: number;
  comment?: string;
  orderIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface PersistedBlob {
  ratings?: UserVendorRating[];
}

const persist = (ratings: UserVendorRating[]) => {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ratings })).catch(() => {
    // Best-effort device-local state; failures are silent and never logged (PII rule).
  });
};

interface VendorRatingState {
  ratings: UserVendorRating[];
  hydrated: boolean;
  /** Upsert the (user, vendor) rating — latest wins, preserving `createdAt`. */
  submitRating: (input: {
    vendorId: string;
    userId: string;
    rating: number;
    comment?: string;
    orderIds: string[];
  }) => void;
  getRating: (userId: string, vendorId: string) => UserVendorRating | undefined;
  reset: () => void;
}

export const useVendorRatingStore = create<VendorRatingState>()((set, get) => ({
  ratings: [],
  hydrated: false,

  submitRating: ({ vendorId, userId, rating, comment, orderIds }) => {
    const now = new Date().toISOString();
    const existing = get().ratings.find(
      (r) => r.userId === userId && r.vendorId === vendorId,
    );
    const entry: UserVendorRating = existing
      ? { ...existing, rating, comment, orderIds, updatedAt: now }
      : { vendorId, userId, rating, comment, orderIds, createdAt: now, updatedAt: now };
    const ratings = existing
      ? get().ratings.map((r) =>
          r.userId === userId && r.vendorId === vendorId ? entry : r,
        )
      : [entry, ...get().ratings];
    set({ ratings });
    persist(ratings);
  },

  getRating: (userId, vendorId) =>
    get().ratings.find((r) => r.userId === userId && r.vendorId === vendorId),

  reset: () => {
    set({ ratings: [] });
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  },
}));

// Hydrate at store creation (fire-and-forget, bloodDonorStore-style).
AsyncStorage.getItem(STORAGE_KEY)
  .then((raw) => {
    if (!raw) return;
    const parsed = JSON.parse(raw) as PersistedBlob;
    useVendorRatingStore.setState({ ratings: parsed.ratings ?? [] });
  })
  .catch(() => {})
  .finally(() => {
    useVendorRatingStore.setState({ hydrated: true });
  });
