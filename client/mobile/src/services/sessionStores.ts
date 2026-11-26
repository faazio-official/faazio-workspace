/**
 * Pull the signed-in user's server-authoritative slices into their device caches.
 *
 * Called after a successful login and after the persisted session is restored at cold start.
 * Every read is independent and best-effort: a failed slice keeps its previous/stale cache and
 * surfaces its own `syncError` rather than blocking the app.
 */
import { useAuthStore } from '@/state/authStore';
import { useCartStore, type CartItem } from '@/state/cartStore';
import { useFavoriteStore } from '@/state/favoriteStore';
import { useOrdersStore } from '@/state/ordersStore';
import { useRewardsStore } from '@/state/rewardsStore';
import { gateway } from '@/services/api/GatewayClient';

/**
 * Push the device-local guest cart into the account's server cart, adding quantities to any lines
 * the account already had (Swiggy-style guest-cart merge). Returns false when the read/write could
 * not complete, so the caller keeps the local cart instead of letting `hydrate()` overwrite it.
 */
async function mergeGuestCart(items: CartItem[]): Promise<boolean> {
  if (items.length === 0) return true;
  try {
    const remote = await gateway.getCart();
    const remoteQty = new Map(remote.items.map((line) => [line.productId, line.qty]));
    for (const line of items) {
      const nextQty = (remoteQty.get(line.id) ?? 0) + line.quantity;
      // POST/PUT both set the absolute quantity at the gateway boundary.
      await gateway.updateCartItem(
        line.id,
        nextQty,
        line.addonIds,
        line.addonPrice,
        line.addonSummary,
      );
    }
    return true;
  } catch {
    return false;
  }
}

export async function hydrateUserStores(): Promise<void> {
  if (!useAuthStore.getState().isAuthenticated) return;

  // A cart built while browsing as a guest lives only on the device (`/cart` is auth-scoped).
  // Merge it into the account *before* the authoritative hydrate below, so the sign-in that
  // resumes a guest checkout keeps the lines the customer picked.
  const guestCart = useCartStore.getState().cart;
  const merged = guestCart.length > 0 ? await mergeGuestCart(guestCart) : true;

  await Promise.allSettled([
    merged ? useCartStore.getState().hydrate() : Promise.resolve(),
    useFavoriteStore.getState().hydrate(),
    useOrdersStore.getState().refresh(),
    useRewardsStore.getState().reconcile(),
  ]);
}
