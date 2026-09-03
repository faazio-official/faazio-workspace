/**
 * @mock Simulates a Go + PostgreSQL store-directory microservice. Consolidates
 * the per-app store fixtures (`mart/stores`, `food/stores`) into one relational
 * table, deduped by `id`. Screens keep using the legacy fixtures until the
 * Gateway surface (src/services/api/GatewayClient) is verified. See data/DATA_CONTROL.md.
 */
import type { StoreProfile } from '../types';
import { martStores } from '../mart/stores';
import { foodStores } from '../food/stores';

/** A store-directory row (PostgreSQL `stores` table). */
export interface StoreRecord {
  id: string;
  app: 'MART' | 'FOOD';
  name: string;
  categories: string[];
  rating: number;
  reviewsCount?: number;
  deliveryTime: string;
  distance: string;
  coverImage: string;
  emoji: string;
  desc: string;
  offerTag?: string;
  isVeg?: boolean;
}

function fromStoreProfile(store: StoreProfile): StoreRecord {
  return {
    id: store.id,
    app: store.app === 'MART' ? 'MART' : 'FOOD',
    name: store.name,
    categories: store.categories,
    rating: store.rating,
    reviewsCount: store.reviewsCount,
    deliveryTime: store.deliveryTime,
    distance: store.distance,
    coverImage: store.coverImage,
    emoji: store.emoji,
    desc: store.desc,
    offerTag: store.offerTag,
    isVeg: store.isVeg,
  };
}

export const storeDirectory: StoreRecord[] = [
  ...martStores.map(fromStoreProfile),
  ...foodStores.map(fromStoreProfile),
];

export function getStoreById(id: string): StoreRecord | undefined {
  return storeDirectory.find((s) => s.id === id);
}

export function getStoresByApp(app: StoreRecord['app']): StoreRecord[] {
  return storeDirectory.filter((s) => s.app === app);
}
