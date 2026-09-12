/**
 * @mock Static fixture — seeded sample data for local development until the Go Chi
 * backend (server/) is wired. See data/DATA_CONTROL.md.
 */
import type { AccountNavGroup } from '../types';

export const accountNavGroups: AccountNavGroup[] = [
  {
    key: 'profile',
    title: 'Profile settings',
    rows: [
      { key: 'orders', icon: 'package', title: 'My Orders', subtitle: 'Track and manage your orders' },
      { key: 'details', icon: 'idcard', title: 'My Profile', subtitle: 'Manage your personal information' },
      { key: 'addresses', icon: 'map-pin', title: 'Addresses', subtitle: 'Manage saved addresses' },
      { key: 'favourites', icon: 'heart', title: 'Favourites', subtitle: 'Your favourite items across all apps' },
      { key: 'recently-viewed', icon: 'clock', title: 'Recently Viewed', subtitle: 'Items you recently viewed' },
    ],
  },
  {
    key: 'payments',
    title: 'Payments and credits',
    rows: [
      { key: 'payments', icon: 'credit-card', title: 'Payments', subtitle: 'UPI, Cards, Wallets, Gift Cards' },
    ],
  },
  {
    key: 'privacy',
    title: 'Privacy and security',
    comingSoon: true,
    rows: [],
  },
  {
    key: 'earn',
    title: 'Earn with us',
    rows: [
      { key: 'sell-with-us', icon: 'store', title: 'Sell with us', subtitle: 'Partner with Faazio & list your products' },
    ],
  },
  {
    key: 'legal',
    title: 'Terms and policies',
    comingSoon: true,
    rows: [],
  },
  {
    key: 'support',
    title: 'Help & Support',
    rows: [
      { key: 'support', icon: 'headphones', title: 'Customer Support', subtitle: 'Help center, Chat with us' },
    ],
  },
];
