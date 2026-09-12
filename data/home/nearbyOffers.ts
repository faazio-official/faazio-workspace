/**
 * @mock Static fixture — seeded sample data for local development until the Go Chi
 * backend (server/) is wired. See data/DATA_CONTROL.md.
 */
import type { NearbyOffer } from '../types';

// Product-level offers surfaced from stores physically near the user.
// These are individual catalog products, rendered with the normal product cards.
export const nearbyOffers: NearbyOffer[] = [
  { id: 'nb-1', app: 'MART', category: 'Electronics', name: 'Pro Noise Cancelling Headphones', price: 4499, originalPrice: 5999, emoji: '🎧', rating: 4.9, desc: 'From a store 1.2 km away', distance: '1.2 km', image: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?fm=jpg&fit=crop&q=80&w=200&h=200', badge: 'Nearby Deal', badgeBg: 'bg-blue-500', attributes: { type: 'Audio', brand: 'SoundPro' } },
  { id: 'nb-2', app: 'FOOD', category: 'Featured', name: 'Spicy Seafood Ramen', price: 450, emoji: '🍜', rating: 4.9, desc: 'From a store 0.8 km away', distance: '0.8 km', image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?fm=jpg&fit=crop&q=80&w=200&h=200', badge: 'Nearby Deal', badgeBg: 'bg-green-500', shop: 'Ramen House' },
  { id: 'nb-3', app: 'MART', category: 'Fresh Produce', name: 'Organic Royal Gala Apples', price: 249, originalPrice: 320, unit: '1 kg', emoji: '🍎', rating: 4.9, desc: 'From a store 1.6 km away', distance: '1.6 km', image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?fm=jpg&fit=crop&q=80&w=200&h=200', badge: 'Nearby Deal', badgeBg: 'bg-emerald-500', attributes: { brand: 'Farm Fresh' } },
  { id: 'nb-4', app: 'PHARMA', category: 'vitamin', name: 'Collagen Complex Gummies', price: 810, originalPrice: 950, unit: '60 gummies', emoji: '💊', rating: 4.8, desc: 'From a store 2.3 km away', distance: '2.3 km', image: 'https://images.unsplash.com/photo-1607619056574-7b8d304f2c38?fm=jpg&fit=crop&q=80&w=200&h=200', badge: 'Nearby Deal', badgeBg: 'bg-teal-500', attributes: { brand: 'NutraWell' } },
  { id: 'nb-5', app: 'MART', category: 'Fashion', name: 'Comfort Street Sneakers', price: 2499, originalPrice: 3299, unit: 'UK 9', emoji: '👟', rating: 4.7, desc: 'From a store 0.5 km away', distance: '0.5 km', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?fm=jpg&fit=crop&q=80&w=200&h=200', badge: 'Nearby Deal', badgeBg: 'bg-indigo-500', attributes: { type: 'Sneakers', brand: 'Stride' } },
  { id: 'nb-6', app: 'FOOD', category: 'Seafood', name: 'Squid Sweet & Sour', price: 399, emoji: '🦑', rating: 4.9, desc: 'From a store 1.9 km away', distance: '1.9 km', image: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?fm=jpg&fit=crop&q=80&w=200&h=200', badge: 'Nearby Deal', badgeBg: 'bg-orange-500', shop: 'The Coastal House' },
];
