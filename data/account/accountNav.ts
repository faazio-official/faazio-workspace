/**
 * @mock Static fixture — seeded sample data for local development until the Go Chi
 * backend (server/) is wired. See data/DATA_CONTROL.md.
 */
import type { AccountNavGroup } from '../types';

export const accountNavGroups: AccountNavGroup[] = [
  {
    key: 'primary',
    rows: [
      { key: 'orders', icon: 'package', title: 'My Orders', subtitle: 'Track and manage your orders' },
      { key: 'details', icon: 'idcard', title: 'Your Details', subtitle: 'Manage your personal information' },
      { key: 'addresses', icon: 'map-pin', title: 'Addresses', subtitle: 'Manage saved addresses' },
      { key: 'payments', icon: 'credit-card', title: 'Payments', subtitle: 'UPI, Cards, Wallets, Gift Cards' },
      { key: 'coupons', icon: 'ticket', title: 'Coupons & Offers', subtitle: 'View all your offers and coupons' },
      { key: 'support', icon: 'headphones', title: 'Customer Support', subtitle: 'Help center, Chat with us' },
    ],
  },
  {
    key: 'preferences',
    rows: [
      { key: 'favourites', icon: 'heart', title: 'Favourites', subtitle: 'Your favourite items across all apps' },
      { key: 'recently-viewed', icon: 'clock', title: 'Recently Viewed', subtitle: 'Items you recently viewed' },
    ],
  },
];
