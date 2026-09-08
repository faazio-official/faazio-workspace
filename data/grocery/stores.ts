/**
 * @mock Static fixture — seeded sample data for local development until the Go Chi
 * backend (server/) is wired. See data/DATA_CONTROL.md.
 *
 * Grocery goods are fulfilled from a single Faazio-run outlet (there is no
 * third-party grocery store). This store backs the `storeId` of every grocery
 * product and provides its self-pickup point.
 */
import type { StoreProfile } from '../types';

export const groceryStores: StoreProfile[] = [
  {
    id: 'store-g1',
    name: 'Faazio Mart Freshmart',
    app: 'GROCERY',
    categories: ['Fresh Produce', 'Dairy & Eggs', 'Bakery', 'Beverages', 'Snacks'],
    rating: 4.8,
    reviewsCount: 2200,
    deliveryTime: '20 min',
    distance: '1.1 km',
    coverImage: 'https://images.unsplash.com/photo-1542838132-92c53300491e?fm=jpg&fit=crop&q=80&w=600&h=300',
    emoji: '🥦',
    desc: 'Daily-fresh fruits, vegetables, dairy and pantry essentials from a local Faazio outlet',
    offerTag: 'FLAT ₹50 OFF on ₹399+',
    isVeg: true,
    address: '22, Fresh Market Complex, Sector 3, Greenwood City - 609602',
    phone: '+91 93003 33301',
    hours: '7 AM – 11 PM',
  },
];

export default groceryStores;
