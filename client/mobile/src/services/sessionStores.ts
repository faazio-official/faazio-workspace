/**
 * Pull the signed-in user's server-authoritative slices into their device caches.
 *
 * Called after a successful login and after the persisted session is restored at cold start.
 * Every read is independent and best-effort: a failed slice keeps its previous/stale cache and
 * surfaces its own `syncError` rather than blocking the app.
 */
import { useAuthStore } from '@/state/authStore';
import { useCartStore } from '@/state/cartStore';
import { useFavoriteStore } from '@/state/favoriteStore';
import { useOrdersStore } from '@/state/ordersStore';
import { useRewardsStore } from '@/state/rewardsStore';

export async function hydrateUserStores(): Promise<void> {
  if (!useAuthStore.getState().isAuthenticated) return;
  await Promise.allSettled([
    useCartStore.getState().hydrate(),
    useFavoriteStore.getState().hydrate(),
    useOrdersStore.getState().refresh(),
    useRewardsStore.getState().reconcile(),
  ]);
}
