import type { NearbyOffer } from '../types';

// Product-level offers surfaced from stores physically near the user.
// Distinct from `storeOffers` (store-level promo banners) — these are
// individual catalog products, rendered with the normal product cards.
export const nearbyOffers: NearbyOffer[] = [
  { id: 'nb-1', app: 'MART', category: 'Electronics', name: 'Pro Noise Cancelling Headphones', price: 4499, emoji: '🎧', rating: 4.9, desc: 'From a store 1.2 km away', image: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit