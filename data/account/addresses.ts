/**
 * @mock Static fixture — seeded sample data for local development until the Go Chi
 * backend (server/) is wired. See data/DATA_CONTROL.md.
 *
 * `latitude`/`longitude` are the exact delivery points (see migration 0125). They matter for two
 * flows that a text address cannot serve: proximity auto-select on a fresh fix, and delivery
 * pricing/auto-dispatch following the chosen address rather than the phone.
 */
import type { SavedAddress } from '../types';

export const savedAddresses: SavedAddress[] = [
  {
    id: 'addr_1',
    tag: 'HOME',
    isDefault: true,
    name: 'Rohit Sharma',
    phone: '+91 98765 43210',
    address: 'Flat 101, Greenwood Residency, Block A, Greenwood Main Road, Greenwood Regency, Bangalore – 560068, Karnataka',
    latitude: 12.8956,
    longitude: 77.6456,
  },
  {
    id: 'addr_2',
    tag: 'WORK',
    name: 'Rohit Sharma',
    phone: '+91 98765 43210',
    address: 'Upcraft Solutions Pvt Ltd, 3rd Floor, 27th Cross, HSR Layout, Sector 2, Bangalore – 560102, Karnataka',
    latitude: 12.9121,
    longitude: 77.6446,
  },
  {
    id: 'addr_3',
    tag: 'OTHER',
    name: 'Rohit Sharma',
    phone: '+91 98765 43210',
    address: '12-8-134, New Friends Colony, Tolichowki, Hyderabad – 500008, Telangana',
    latitude: 17.4046,
    longitude: 78.4199,
  },
];
