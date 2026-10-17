import type { StoreProfile } from '@data/types';
import { gateway, type HeroAd } from './api/GatewayClient';

export interface HeroTargetHandlers {
  /** Open a product/dish deep-link target (PDP / restaurant menu anchor). */
  onProduct: (product: unknown) => void;
  /** Open a store/venue deep-link target. */
  onStore: (store: StoreProfile) => void;
  /**
   * Optional: open a dining venue (restaurant) target — used for DISH/VENUE ads in the Food
   * sub-app. `dishId` is set when the ad targets a specific dish, so the host can anchor the menu.
   */
  onVenue?: (store: StoreProfile, dishId?: string) => void;
}

/**
 * Resolves a hero creative's deep-link target to a real row and hands it to the host's navigator.
 * The target is server-scoped to the seller's own item, so a hostile payload can only resolve to a
 * legitimate catalog/store row. Best-effort: an unresolvable target is a no-op.
 *
 * `PRODUCT`/`DISH` resolve through the catalog first; when a dish has no catalog row the host's
 * `onVenue` fallback opens its restaurant page. `STORE`/`VENUE` resolve to a store/venue record.
 */
export async function openHeroTarget(ad: HeroAd, handlers: HeroTargetHandlers): Promise<void> {
  try {
    if (ad.targetType === 'PRODUCT') {
      const res = await gateway.getProduct(ad.targetId);
      if (res?.product) handlers.onProduct(res.product);
      return;
    }
    if (ad.targetType === 'DISH') {
      const res = await gateway.getProduct(ad.targetId);
      if (res?.product) {
        handlers.onProduct(res.product);
        return;
      }
      if (handlers.onVenue && ad.storeId) {
        const venue = await gateway.getStore(ad.storeId);
        if (venue) handlers.onVenue(venue as unknown as StoreProfile, ad.targetId);
      }
      return;
    }
    if (ad.targetType === 'STORE' || ad.targetType === 'VENUE') {
      const store = await gateway.getStore(ad.targetId);
      if (!store) return;
      if (handlers.onVenue && ad.targetType === 'VENUE') {
        handlers.onVenue(store as unknown as StoreProfile);
      } else {
        handlers.onStore(store as unknown as StoreProfile);
      }
    }
  } catch {
    // best-effort — never block the tap on a failed resolve
  }
}