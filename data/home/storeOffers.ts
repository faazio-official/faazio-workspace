/**
 * @mock Static fixture — seeded sample data for local development until the Go Chi
 * backend (server/) is wired. See data/DATA_CONTROL.md.
 */
import type { StoreOffer } from '../types';

// Static seed for now. Intended to become seller/store-owner managed data
// once the backend + seller dashboard exist. See PENDING_WORK.md.
export const storeOffers: StoreOffer[] = [
  { id: 'so-1', storeId: 'store-m5', storeName: 'Korean Glow Care HQ', app: 'MART', emoji: '✨', coverImage: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?fm=jpg&fit=crop&q=80&w=600&h=300', offerTitle: 'Free Sheet Mask on ₹999+', offerTag: 'LIMITED TIME', distance: '0.9 km', rating: 4.9 },
  { id: 'so-2', storeId: 'store-m3', storeName: 'Thread Labs Studio', app: 'MART', emoji: '👔', coverImage: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?fm=jpg&fit=crop&q=80&w=600&h=300', offerTitle: 'Buy 2 Get 1 Free — Streetwear', offerTag: 'WEEKEND ONLY', distance: '3.1 km', rating: 4.9 },
  { id: 'so-3', storeId: 'store-m7', storeName: 'SmartHome Emporium', app: 'MART', emoji: '🏠', coverImage: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?fm=jpg&fit=crop&q=80&w=600&h=300', offerTitle: '0% EMI on Smart Appliances', offerTag: 'NO COST EMI', distance: '4.5 km', rating: 4.9 },
];
