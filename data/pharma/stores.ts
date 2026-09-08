/**
 * @mock Static fixture — seeded sample data for local development until the Go Chi
 * backend (server/) is wired. See data/DATA_CONTROL.md.
 *
 * Pharma goods are fulfilled from a single Faazio-run pharmacy outlet (there is no
 * third-party pharma store). This store backs the `storeId` of every pharma product
 * and provides its self-pickup point.
 */
import type { StoreProfile } from '../types';

export const pharmaStores: StoreProfile[] = [
  {
    id: 'store-p1',
    name: 'Faazio Health Pharmacy',
    app: 'PHARMA',
    categories: ['Vitamin', 'Supplements', 'Fever', 'Cough & Cold', 'Devices'],
    rating: 4.9,
    reviewsCount: 3100,
    deliveryTime: '25 min',
    distance: '1.6 km',
    coverImage: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?fm=jpg&fit=crop&q=80&w=600&h=300',
    emoji: '💊',
    desc: 'Licensed pharmacy outlet with cold-storage for medicines and health devices',
    offerTag: 'FLAT ₹100 OFF on ₹499+',
    isVeg: true,
    address: '4, Wellness Plaza, Health Street, Greenwood City - 609602',
    phone: '+91 94004 44401',
    hours: '8 AM – 10 PM',
  },
];

export default pharmaStores;
