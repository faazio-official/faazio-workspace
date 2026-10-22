import { create } from 'zustand';
import type {
  DeliveryPartnerDetail,
  DeliveryPartnerRider,
} from '@/services/api/GatewayClient';

/**
 * Delivery-partner app state. Only the rider record lives here; the Firebase session stays in
 * `@/state/authStore` (Keychain is the single token owner).
 */
interface DeliveryPartnerState {
  phone: string;
  rider: DeliveryPartnerRider | null;
  detail: DeliveryPartnerDetail | null;
  setPhone: (phone: string) => void;
  setRider: (rider: DeliveryPartnerRider | null) => void;
  setDetail: (detail: DeliveryPartnerDetail | null) => void;
  reset: () => void;
}

export const useDeliveryPartnerStore = create<DeliveryPartnerState>()((set) => ({
  phone: '',
  rider: null,
  detail: null,
  setPhone: (phone) => set({ phone }),
  setRider: (rider) => set({ rider }),
  setDetail: (detail) => set({ detail }),
  reset: () => set({ phone: '', rider: null, detail: null }),
}));
