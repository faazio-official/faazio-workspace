import { useEffect, useState } from 'react';
import { gateway, type PrescriptionRecord } from '@/services/api/GatewayClient';

/**
 * Polls the durable prescription (by order id) so the customer sees the seller quote and the
 * READY reveal without a push channel. Remote mode only — the caller gates on `gateway.remoteEnabled`.
 * Stops as soon as the Rx reaches a terminal status (READY/FULFILLED/CANCELLED).
 */
const POLL_MS = 10_000;
const TERMINAL = new Set(['READY', 'FULFILLED', 'CANCELLED']);

export function usePrescriptionDetail(orderId: string | undefined, enabled: boolean) {
  const [rx, setRx] = useState<PrescriptionRecord | null>(null);

  useEffect(() => {
    if (!enabled || !orderId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const list = await gateway.getPrescriptions();
        const match = list.find((r) => r.id === orderId);
        if (!cancelled && match) {
          setRx(match);
          if (TERMINAL.has(match.status)) return;
        }
      } catch {
        /* keep the last known state; retry on the next tick */
      }
      if (!cancelled) timer = setTimeout(poll, POLL_MS);
    };

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [orderId, enabled]);

  return rx;
}