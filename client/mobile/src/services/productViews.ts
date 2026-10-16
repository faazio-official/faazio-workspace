import { gateway } from './api/GatewayClient';

/**
 * Products already reported this session. `user_events` has no (user, product, event) dedupe, so
 * the client bounds passive-impression volume — one `view` per product per app session. Opening a
 * product still emits its own `view` from `ProductDetailScreen` (interest signal), and `cart_add`
 * fires on add; this helper only covers passive Mart/Search impressions.
 *
 * Reset on logout so a new session re-reports. Kept in a plain module `Set` (no persisted state).
 */
const seen = new Set<string>();

/** Report a `view` impression at most once per product per session. Best-effort, never blocks. */
export function trackProductView(productId: string): void {
  if (!productId || seen.has(productId)) return;
  seen.add(productId);
  void gateway.trackEvent(productId, 'view').catch(() => {});
}

/** Clear the session impression set (logout / account switch). */
export function resetProductViews(): void {
  seen.clear();
}