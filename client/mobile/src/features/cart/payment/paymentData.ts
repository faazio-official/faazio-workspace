/**
 * Customer-facing payment method. Phase 1 supports UPI (GPay / PhonePe / Paytm / BHIM via
 * intent) and Cash on Delivery only.
 */
export type PaymentMethod = 'UPI' | 'COD';

/** Merchant VPA baked into the UPI intent `pa` param. The server may override with `upiVpa`. */
export const UPI_MERCHANT_VPA = 'faazio@razorpay';

/** Merchant display name baked into the UPI intent `pn` param. */
export const UPI_MERCHANT_NAME = 'Faazio';

/** Cash on Delivery radio row (`id` is a literal for narrowing). */
export interface CodMethod {
  id: 'cod';
  label: string;
  subtitle: string;
}

/** Cash on Delivery radio row config. */
export const COD_METHOD: CodMethod = {
  id: 'cod',
  label: 'Cash on Delivery',
  subtitle: 'Pay in cash when your order arrives',
};

/** A card saved on this device (tokenized — never a raw PAN/CVV). */
export interface SavedCard {
  id: string;
  /** Opaque gateway token minted at keychain save; the only stored credential. */
  token: string;
  network: string;
  last4: string;
  exp: string;
  default?: boolean;
}

/** One UPI app probed at runtime via deep-link visibility (package/scheme). */
export interface UpiAppPackage {
  id: string;
  label: string;
  androidPackage: string;
  iosScheme: string;
}

/** Origin store label for the delivery timeline. */
export const DELIVERY_ORIGIN = 'Instamart';

/**
 * Saved cards start empty — the only way a card enters this list is a successful,
 * secure "Add New Card" (token stored in device Keychain under `FaazioCardToken`).
 * Raw PAN/CVV never touch app state or logs.
 */
export const SAVED_CARDS: SavedCard[] = [];

/** UPI apps detected at checkout via `Linking.canOpenURL(scheme)` per scheme. */
export const UPI_APP_PACKAGES: UpiAppPackage[] = [
  {
    id: 'gpay',
    label: 'Google Pay',
    androidPackage: 'com.google.android.apps.nbu.paisa.user',
    iosScheme: 'gpay://',
  },
  {
    id: 'phonepe',
    label: 'PhonePe',
    androidPackage: 'com.phonepe.app',
    iosScheme: 'phonepe://',
  },
  {
    id: 'paytm',
    label: 'Paytm',
    androidPackage: 'net.one97.paytm',
    // Paytm's iOS scheme is `paytmmp` (not `paytm`); the launch intent is rewritten to
    // `paytmmp://upi/pay?...` (see UpiIntent.ts / ios/Info.plist).
    iosScheme: 'paytmmp://',
  },
  {
    id: 'amazon-pay',
    label: 'Amazon Pay',
    androidPackage: 'in.amazon.mShop.android.shopping',
    iosScheme: 'amazonpay://',
  },
  {
    id: 'bhim',
    label: 'BHIM UPI',
    androidPackage: 'in.org.npci.upiapp',
    iosScheme: 'bhim://',
  },
];