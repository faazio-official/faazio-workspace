import { create } from 'zustand';
import type { DeliveryPartnerRider } from '@/services/api/GatewayClient';

/** In-progress (accepted) job surfaced as the raised CTA above the bottom bar. */
export interface DeliveryActiveOrder {
  orderId: string;
  label: string;
}

/**
 * Delivery-partner app state. Only the rider record lives here; the Firebase session stays in
 * `@/state/authStore` (Keychain is the single token owner).
 */
interface DeliveryPartnerState {
  phone: string;
  rider: DeliveryPartnerRider | null;
  activeOrder: DeliveryActiveOrder | null;
  /** Shared shift presence — every page's top bar reads and toggles this. */
  online: boolean;
  /** Unread alerts count shown on every page's top bar. */
  unread: number;
  /** iOS background-location consent, shared so the shift lifecycle can resume the watch. */
  iosBackgroundAllowed: boolean;
  setPhone: (phone: string) => void;
  setRider: (rider: DeliveryPartnerRider | null) => void;
  setActiveOrder: (activeOrder: DeliveryActiveOrder | null) => void;
  setOnline: (online: boolean) => void;
  setUnread: (unread: number) => void;
  setIosBackgroundAllowed: (allowed: boolean) => void;
  reset: () => void;
}

export const useDeliveryPartnerStore = create<DeliveryPartnerState>()((set) => ({
  phone: '',
  rider: null,
  activeOrder: null,
  online: false,
  unread: 0,
  iosBackgroundAllowed: false,
  setPhone: (phone) => set({ phone }),
  setRider: (rider) => set({ rider }),
  setActiveOrder: (activeOrder) => set({ activeOrder }),
  setOnline: (online) => set({ online }),
  setUnread: (unread) => set({ unread }),
  setIosBackgroundAllowed: (iosBackgroundAllowed) => set({ iosBackgroundAllowed }),
  reset: () =>
    set({
      phone: '',
      rider: null,
      activeOrder: null,
      online: false,
      unread: 0,
      iosBackgroundAllowed: false,
    }),
}));
