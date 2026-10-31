/**
 * Cold-start UPI reconciliation.
 *
 * A UPI payment is settled server-side by the Razorpay webhook, but the customer can kill Faazio
 * before the app observes the result. We persist the in-flight order id when a UPI intent launches
 * and re-check it on the next app open, then route to the authoritative status. The marker is
 * cleared only once the server reports a terminal state (PAID/FAILED).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { gateway } from '@/services/api/GatewayClient';
import type { PaymentStatusResult } from '@/services/api/GatewayClient';

const PENDING_UPI_ORDER_KEY = 'faazio.pending_upi_order';

export type ReconcileOutcome =
  | { kind: 'none' }
  | { kind: 'paid'; orderId: string }
  | { kind: 'failed'; orderId: string };

/** Remember the order awaiting a UPI result (best-effort; reconciliation is opportunistic). */
export async function markUpiOrderPending(orderId: string): Promise<void> {
  if (!orderId) return;
  try {
    await AsyncStorage.setItem(PENDING_UPI_ORDER_KEY, orderId);
  } catch {
    // Storage unavailable — the in-app foreground poll still covers the common case.
  }
}

/** Clear the marker once the payment is terminal (or the user switches to COD). */
export async function clearUpiOrderPending(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_UPI_ORDER_KEY);
  } catch {
    // ignore
  }
}

/** The last order awaiting a UPI result, if any. */
export async function getPendingUpiOrder(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PENDING_UPI_ORDER_KEY);
  } catch {
    return null;
  }
}

/**
 * Re-check the persisted in-flight UPI order exactly once. Returns the terminal outcome when the
 * server has resolved it (and clears the marker); a still-PENDING or unreadable order keeps the
 * marker so a later foreground pass can try again.
 */
export async function reconcilePendingUpiOrder(): Promise<ReconcileOutcome> {
  const orderId = await getPendingUpiOrder();
  if (!orderId) return { kind: 'none' };
  let status: PaymentStatusResult['status'];
  try {
    ({ status } = await gateway.fetchPaymentStatus(orderId));
  } catch {
    return { kind: 'none' };
  }
  if (status === 'PAID') {
    await clearUpiOrderPending();
    return { kind: 'paid', orderId };
  }
  if (status === 'FAILED') {
    await clearUpiOrderPending();
    return { kind: 'failed', orderId };
  }
  return { kind: 'none' };
}