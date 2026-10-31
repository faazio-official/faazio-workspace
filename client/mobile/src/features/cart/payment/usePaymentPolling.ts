/**
 * Foreground-only payment polling. Polls the server for an order's payment status every
 * few seconds while the app is active, and immediately re-polls when the app returns to the
 * foreground (the user comes back from the UPI app). The server (Razorpay webhook) is the
 * source of truth; polling only transitions the UI.
 *
 * No polling happens when the app is backgrounded (battery), and the attempt times out after
 * `timeoutMs` (default 10 minutes) so a stuck attempt never polls forever.
 */
import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

export type PolledPaymentStatus = 'PENDING' | 'PAID' | 'FAILED';

export interface PaymentPollResult {
  status: PolledPaymentStatus;
  /** True when the attempt hit `timeoutMs` without resolving. */
  timedOut: boolean;
  /** Milliseconds since polling started (for the on-screen timer). */
  elapsedMs: number;
}

export interface UsePaymentPollingOptions {
  /** Poll cadence while foregrounded. */
  intervalMs?: number;
  /** Hard stop after this long without a terminal status. */
  timeoutMs?: number;
  /** When false, polling is idle (nothing scheduled). */
  enabled?: boolean;
  /** One status read (typically `gateway.fetchPaymentStatus(orderId)`). */
  poll: (orderId: string) => Promise<{ status: PolledPaymentStatus }>;
  /** Fired once with the terminal status (`PAID`/`FAILED`) and whether the attempt timed out. */
  onResolved: (status: PolledPaymentStatus, timedOut: boolean) => void;
}

const DEFAULT_INTERVAL_MS = 2500;
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

export function usePaymentPolling(orderId: string, options: UsePaymentPollingOptions): PaymentPollResult {
  const {
    intervalMs = DEFAULT_INTERVAL_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    enabled = true,
    poll,
    onResolved,
  } = options;

  const [status, setStatus] = useState<PolledPaymentStatus>('PENDING');
  const [timedOut, setTimedOut] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  // Latest callbacks without re-subscribing the effect (they close over changing props).
  const pollRef = useRef(poll);
  pollRef.current = poll;
  const resolvedRef = useRef(onResolved);
  resolvedRef.current = onResolved;

  useEffect(() => {
    if (!enabled) return;
    const startedAt = Date.now();
    let settled = false;
    let cancelled = false;
    setStatus('PENDING');
    setTimedOut(false);
    setElapsedMs(0);

    const finish = (terminal: PolledPaymentStatus, wasTimeout = false) => {
      if (settled || cancelled) return;
      settled = true;
      setStatus(terminal);
      resolvedRef.current(terminal, wasTimeout);
    };

    const runPoll = async () => {
      if (cancelled || settled) return;
      if (AppState.currentState !== 'active') return; // foreground only
      if (Date.now() - startedAt >= timeoutMs) {
        setTimedOut(true);
        finish('FAILED', true);
        return;
      }
      try {
        const res = await pollRef.current(orderId);
        if (res.status !== 'PENDING') finish(res.status);
      } catch {
        // Transient (network blip / app returning from background) — keep polling.
      }
    };

    const onAppState = (next: AppStateStatus) => {
      if (next === 'active') void runPoll();
    };
    const sub = AppState.addEventListener('change', onAppState);
    void runPoll();
    const tick = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
      void runPoll();
    }, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(tick);
      sub.remove();
    };
  }, [orderId, enabled, intervalMs, timeoutMs]);

  return { status, timedOut, elapsedMs };
}
