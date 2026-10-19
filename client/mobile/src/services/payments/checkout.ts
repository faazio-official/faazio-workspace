/**
 * Payment checkout seam for seat bookings.
 *
 * Today the app ships with `mockCheckout`: it simulates the Razorpay sheet (no network, no native
 * module) and returns a synthetic `pay_mock_…` id, which the client records via
 * `POST /bookings/{id}/payment`. This keeps the full hold → authorize → settle/refund lifecycle
 * exercisable in dev and CI while the gateway runs its own mock payment rail.
 *
 * Production (no code change to screens): install `react-native-razorpay`, implement a
 * `PaymentCheckout` that calls `RazorpayCheckout.open(...)` and maps the result to
 * `{ razorpayPaymentId, razorpayOrderId, signature }`, then register it once at startup via
 * `setPaymentCheckout(razorpayCheckout)`. `BookingSheet` only talks to this interface — the server
 * already creates the order and captures/refunds; the client only returns the authorized payment id.
 *
 * Safety: when a real publishable key id is present (the gateway is in live Razorpay mode) but no
 * adapter has been registered, `open` refuses to fabricate a payment — so a misconfigured deploy
 * fails loudly instead of marking an unpaid hold as authorized.
 */

export interface CheckoutRequest {
  /** Server-created Razorpay order id (empty in pure-mock/offline mode). */
  orderId: string;
  /** Amount in paisa (server-derived: ₹50 × seats); the client never decides this. */
  amountPaisa: number;
  currency?: string;
  /** Publishable Razorpay key id from the create-booking response (empty in mock gateway mode). */
  keyId?: string;
  name?: string;
  description?: string;
  prefill?: { contact?: string; email?: string };
}

export interface CheckoutResult {
  razorpayPaymentId: string;
  razorpayOrderId: string;
  /** Razorpay signature — present only with the real SDK (server-side verification in prod). */
  signature?: string;
}

export interface PaymentCheckout {
  /** Opens the payment sheet; resolves with the authorized payment, rejects on dismiss/failure. */
  open(req: CheckoutRequest): Promise<CheckoutResult>;
}

/** Simulated sheet latency so the pending state is visible in dev. */
const MOCK_LATENCY_MS = 700;

const mockCheckout: PaymentCheckout = {
  open: async (req) => {
    if (req.keyId) {
      throw new Error(
        'Razorpay checkout unavailable: install react-native-razorpay and register an adapter via setPaymentCheckout().',
      );
    }
    await new Promise((resolve) => setTimeout(() => resolve(undefined), MOCK_LATENCY_MS));
    return {
      razorpayPaymentId: `pay_mock_${Math.random().toString(36).slice(2, 12)}`,
      razorpayOrderId: req.orderId,
    };
  },
};

let active: PaymentCheckout = mockCheckout;

/** Registers the checkout implementation once (prod passes the real Razorpay adapter). */
export function setPaymentCheckout(impl: PaymentCheckout): void {
  active = impl;
}

/** The active checkout. Mock until a real adapter is registered. */
export function paymentCheckout(): PaymentCheckout {
  return active;
}