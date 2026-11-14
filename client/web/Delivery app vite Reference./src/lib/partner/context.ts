import { createContext } from "react";
import type { Order, Partner, Referral, VoucherPurchase } from "@/mocks";

export interface PartnerState {
  bookGigs: (ids: string[]) => boolean;
  cart: string[];
  addVoucher: (id: string) => void;
  removeVoucher: (id: string) => void;
  walletBalance: number;
  voucherPurchases: VoucherPurchase[];
  checkoutVouchers: () => string | null;
  bookings: string[];
  toggleShift: (id: string) => void;
  referrals: Referral[];
  invite: (name: string, phone: string, city: string) => string | null;
  readMessages: string[];
  markRead: (id: string) => void;
  disputes: { id: string; orderId: string; reason: string }[];
  submitDispute: (orderId: string, reason: string) => boolean;
  onlineSeconds: number;
  rejections: number;
  loggedIn: boolean;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  onDuty: boolean;
  setOnDuty: (value: boolean) => void;
  orders: Order[];
  offer: Order | null;
  acceptOffer: () => void;
  rejectOffer: () => void;
  advance: (id: string, pin?: string, cashCollected?: boolean) => boolean;
  checkedItems: Record<string, string[]>;
  toggleItem: (id: string, name: string) => void;
  partner: Partner;
}

// Keep context identity independent of the provider's hot-reloaded implementation.
export const PartnerContext = createContext<PartnerState | null>(null);