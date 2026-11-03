"use client";
// Seller console chrome state that is NOT server data: online/offline, rush mode, scheduled time
// off and delivery fee settings. Live api hooks stay in src/lib/api; this slice only backs the
// reference UIs that previously had no platform equivalent. Persisted so toggles survive navigation.
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface RushState {
  on: boolean;
  /** Human label, e.g. "until 3:30 PM" — the gateway has no rush concept, this is a local toggle. */
  until?: string;
}

export interface DeliverySettings {
  minOrder: number;
  packagingCharge: number;
  radiusKm: number;
}

interface SellerUiState {
  online: boolean;
  rush: RushState;
  scheduleOff: { reason: string; from: string; to: string } | null;
  delivery: DeliverySettings;
  setOnline: (online: boolean) => void;
  setRush: (rush: RushState) => void;
  setScheduleOff: (scheduleOff: SellerUiState["scheduleOff"]) => void;
  setDelivery: (patch: Partial<DeliverySettings>) => void;
}

export const useSellerUi = create<SellerUiState>()(
  persist(
    (set) => ({
      online: true,
      rush: { on: false },
      scheduleOff: null,
      delivery: { minOrder: 100, packagingCharge: 20, radiusKm: 8 },
      setOnline: (online) => set({ online }),
      setRush: (rush) => set({ rush }),
      setScheduleOff: (scheduleOff) => set({ scheduleOff }),
      setDelivery: (delivery) =>
        set((s) => ({ delivery: { ...s.delivery, ...delivery } })),
    }),
    {
      name: "faazio-seller-ui",
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? {
              getItem: () => null,
              setItem: () => undefined,
              removeItem: () => undefined,
            }
          : window.localStorage,
      ),
    },
  ),
);