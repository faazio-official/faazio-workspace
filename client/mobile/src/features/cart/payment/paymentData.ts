import type { LucideIcon } from 'lucide-react-native';
import { Landmark, Wallet, Banknote } from 'lucide-react-native';

export interface SavedCard {
  id: string;
  network: string;
  last4: string;
  exp: string;
  default?: boolean;
}

export interface SavedUpi {
  id: string;
  label: string;
  handle: string;
  emoji: string;
}

export interface MoreOption {
  id: string;
  label: string;
  subtitle: string;
  icon: LucideIcon;
}

/** Origin store label for the delivery timeline. */
export const DELIVERY_ORIGIN = 'Instamart';

/** Preferred card — selected by default (green check + CVV/Pay bar). */
export const DEFAULT_CARD: SavedCard = {
  id: 'axis',
  network: 'Axis Bank Card',
  last4: '4242',
  exp: '12/26',
  default: true,
};

export const OTHER_CARDS: SavedCard[] = [
  { id: 'hdfc', network: 'HDFC Bank Card', last4: '9031', exp: '09/25' },
  { id: 'icici', network: 'ICICI Bank Card', last4: '7788', exp: '03/27' },
];

export const SAVED_UPIS: SavedUpi[] = [
  { id: 'gpay', label: 'GPay', handle: 'user@okhdfcbank', emoji: '\u{1F4B1}' },
  { id: 'phonepe', label: 'PhonePe', handle: 'user@ybl', emoji: '\u{1F4F1}' },
];

export const MORE_OPTIONS: MoreOption[] = [
  { id: 'netbanking', label: 'Net Banking', subtitle: 'All banks supported', icon: Landmark },
  { id: 'wallet', label: 'Wallets', subtitle: 'Amazon Pay, Paytm & more', icon: Wallet },
  { id: 'cod', label: 'Cash on Delivery', subtitle: 'Pay at your doorstep', icon: Banknote },
];
