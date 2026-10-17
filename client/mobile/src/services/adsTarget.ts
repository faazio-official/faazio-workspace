import type { StoreProfile } from '@data/types';
import { gateway, type HeroAd } from './api/GatewayClient';

export interface HeroTargetHandlers {
  /** Open a product/dish deep-link target (PDP / restaurant menu anchor). */
  onProduct: (product: unknown) => void;
  /** Open a store/venue deep-link target. */
  onStore: (store: StoreProfile) => void;
}

/**
 * Resolves a hero creative's deep-link target to a real row and hands it to the host's navigator.
 * The target is server-scoped to the seller's own item, so a hostile payload can only resolve to a
 * legitimate catalog/store row. Best-effort: an unresolvable target is a no-op.
 */
export async function openHeroTarget(ad: HeroAd, handlers: HeroTargetHandlers): Promise<void> {
  try {
    if (ad.targetType === 'PRODUCT' || ad.targetType === 'DISH') {
      const res = await gateway.getProduct(ad.targetId);
      if (res?.product) handlers.onProduct(res.product);
      return;
    }
    if (ad.targetType === 'STORE' || ad.targetType === 'VENUE') {
      const store = await gateway.getStore(ad.targetId);
      if (store) handlers.onStore(store as unknown as StoreProfile);
    }
  } catch {
    // best-effort — never block the tap on a failed resolve
  }
}