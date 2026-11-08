import { useCallback, useEffect, useRef, useState } from 'react';
import { gateway, GatewayHttpError } from '@/services/api/GatewayClient';

/**
 * The customer's payment state for a prescription order. The Rx id doubles as the checkout order id
 * once the quote has been accepted (`POST /prescriptions/{id}/checkout`), so `fetchPaymentStatus`
 * resolves it through the same rail as a cart order.
 *
 * `UNPAID` covers both "not accepted yet" (the materialised order does not exist → 404) and any
 * transient read failure, so the Pay affordance stays available without ever showing a false "Paid".
 */
export type RxPaymentState = 'UNPAID' | 'PENDING' | 'PAID' | 'FAILED';

const POLL_MS = 15_000;

export function usePrescriptionPayment(
  orderId: string | undefined,
  enabled: boolean,
): { state: RxPaymentState; refresh: () => void } {
  const [state, setState] = useState<RxPaymentState>('UNPAID');
  const [nonce, setNonce] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled || !orderId) {
      setState('UNPAID');
      return;
    }
    // Already settled — nothing left to poll.
    if (state === 'PAID' || state === 'FAILED') return;
    let cancelled = false;
    const read = async () => {
      try {
        const res = await gateway.fetchPaymentStatus(orderId);
        if (cancelled || !mounted.current) return;
        if (res.status === 'PAID') setState('PAID');
        else if (res.status === 'FAILED') setState('FAILED');
        else setState('PENDING');
      } catch (err) {
        if (cancelled || !mounted.current) return;
        // 404 = the quote has not been accepted yet; anything else is a transient read failure.
        if (err instanceof GatewayHttpError && err.status === 404) setState('UNPAID');
      }
    };
    void read();
    const timer = setInterval(() => {
      void read();
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [orderId, enabled, nonce, state]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  return { state, refresh };
}
