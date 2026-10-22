/**
 * Delivery offer deep links. A push tap or an external `faazio-delivery://accept-reject?orderId=…`
 * URL opens the dedicated 45 s offer screen. If navigation is not mounted yet (cold start) the
 * request waits in memory and flushes once the navigator reports ready.
 */
import { Linking } from 'react-native';
import { deliveryNavigationRef } from '@/features/delivery-partner/navigationRef';
import { useAuthStore } from '@/state/authStore';

type OfferLink = { orderId: string; expiresAt?: string };

let pending: OfferLink | null = null;
let initialUrlConsumed = false;

function navigateToOffer(link: OfferLink): void {
  if (!deliveryNavigationRef.isReady()) return;
  if (!useAuthStore.getState().isAuthenticated) return;
  deliveryNavigationRef.navigate('AcceptReject', {
    orderId: link.orderId,
    ...(link.expiresAt ? { expiresAt: link.expiresAt } : {}),
  });
}

/** Queue an offer navigation, immediately when possible or once the navigator is ready. */
export function openDeliveryOffer(link: OfferLink): void {
  if (!link.orderId) return;
  if (deliveryNavigationRef.isReady() && useAuthStore.getState().isAuthenticated) {
    navigateToOffer(link);
    return;
  }
  pending = link;
}

/** Called by the root NavigationContainer's onReady handler. */
export function flushPendingDeliveryOffer(): void {
  if (!pending) return;
  const link = pending;
  pending = null;
  navigateToOffer(link);
}

/** Parse `faazio-delivery://accept-reject?orderId=…` (also tolerates a `type` query param). */
export function parseDeliveryOfferLink(url: string): OfferLink | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'faazio-delivery:') return null;
    const orderId = parsed.searchParams.get('orderId') ?? parsed.searchParams.get('order_id');
    if (!orderId) return null;
    const expiresAt = parsed.searchParams.get('expiresAt') ?? undefined;
    return { orderId, ...(expiresAt ? { expiresAt } : {}) };
  } catch {
    return null;
  }
}

/**
 * Listen for offer deep links (warm start) and consume the launch URL (cold start). Returns a
 * cleanup that removes the listener.
 */
export function startDeliveryOfferLinks(): () => void {
  const handle = (url: string | null) => {
    if (!url) return;
    const link = parseDeliveryOfferLink(url);
    if (link) openDeliveryOffer(link);
  };
  // getInitialURL keeps returning the launch URL for the app's lifetime, so consume it once.
  if (!initialUrlConsumed) {
    initialUrlConsumed = true;
    void Linking.getInitialURL().then(handle).catch(() => undefined);
  }
  const sub = Linking.addEventListener('url', (event) => handle(event.url));
  return () => sub.remove();
}
