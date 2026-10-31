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
    ],
  },
  {
    key: 'privacy',
    title: 'Privacy and security',
    rows: [
      {
        key: 'delete-account',
        icon: 'trash',
        title: 'Delete account',
        subtitle: 'Permanently delete your Faazio account',
      },
      {
        key: 'request-data-deletion',
        icon: 'shield',
        title: 'Request data deletion',
        subtitle: 'Erase selected data and keep your account',
      },
    ],
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
    rows: [
      {
        key: 'terms',
        icon: 'file-text',
        title: 'Terms & Conditions',
        subtitle: 'How Faazio works and what you agree to',
      },
      {
        key: 'privacy',
        icon: 'lock',
        title: 'Privacy Policy',
        subtitle: 'How we collect, use, and protect your data',
      },
      {
        key: 'refunds',
        icon: 'receipt',
        title: 'Refund & Cancellation Policy',
        subtitle: 'Returns, refunds, and cancellations',
      },
      {
        key: 'cookies',
        icon: 'cookie',
        title: 'Cookie Policy',
        subtitle: 'Cookies used on faazio.com',
      },
      {
        key: 'disclaimer',
        icon: 'info',
        title: 'Disclaimer',
        subtitle: 'Health, pricing, and third-party notices',
      },
    ],
  },
];
