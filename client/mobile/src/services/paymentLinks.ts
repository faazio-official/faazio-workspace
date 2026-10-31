/**
 * Customer payment deep links.
 *
 * The UPI intent carries `url=faazio://payment/callback` (see `UpiIntent.ts`). When a UPI app
 * redirects back, the OS opens Faazio and we route to the PaymentCallback screen, which verifies
 * the result against the server (the webhook is the source of truth). A cold start queues the
 * callback until the navigator reports ready and the session is restored.
 */
import { Linking } from 'react-native';
import { navigationRef } from '@/navigation/navigationRef';
import { useAuthStore } from '@/state/authStore';

export interface PaymentCallbackLink {
  orderId?: string;
  status?: 'PAID' | 'FAILED' | 'PENDING';
}

let pending: PaymentCallbackLink | null = null;
let initialUrlConsumed = false;

function navigate(link: PaymentCallbackLink): void {
  if (!navigationRef.isReady()) return;
  if (!useAuthStore.getState().isAuthenticated) return;
  navigationRef.navigate('PaymentCallback', link);
}

/** Queue a payment-callback navigation (immediately when possible, else once the navigator is ready). */
export function openPaymentCallback(link: PaymentCallbackLink): void {
  if (navigationRef.isReady() && useAuthStore.getState().isAuthenticated) {
    navigate(link);
    return;
  }
  pending = link;
}

/** Flush a queued callback. Called from the root NavigationContainer's `onReady` and after login. */
export function flushPendingPaymentCallback(): void {
  if (!pending) return;
  const link = pending;
  pending = null;
  navigate(link);
}

/** Parse `faazio://payment/callback?order_id=...&status=...`; any other URL returns null. */
export function parsePaymentCallbackLink(url: string): PaymentCallbackLink | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'faazio:') return null;
    const path = parsed.pathname.replace(/\/+$/, '');
    if (parsed.host !== 'payment' || path !== '/callback') return null;
    const orderId =
      parsed.searchParams.get('order_id') ?? parsed.searchParams.get('orderId') ?? undefined;
    const rawStatus = parsed.searchParams.get('status');
    const status =
      rawStatus === 'PAID' || rawStatus === 'FAILED' || rawStatus === 'PENDING'
        ? rawStatus
        : undefined;
    return { ...(orderId ? { orderId } : {}), ...(status ? { status } : {}) };
  } catch {
    return null;
  }
}

/**
 * Listen for payment deep links (warm start) and consume the launch URL (cold start). Returns a
 * cleanup that removes the listener.
 */
export function startPaymentCallbackLinks(): () => void {
  const handle = (url: string | null) => {
    if (!url) return;
    const link = parsePaymentCallbackLink(url);
    if (link) openPaymentCallback(link);
  };
  // getInitialURL keeps returning the launch URL for the app's lifetime, so consume it once.
  if (!initialUrlConsumed) {
    initialUrlConsumed = true;
    void Linking.getInitialURL().then(handle).catch(() => undefined);
  }
  const sub = Linking.addEventListener('url', (event) => handle(event.url));
  return () => sub.remove();
}