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
    iosScheme: 'paytm://',
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