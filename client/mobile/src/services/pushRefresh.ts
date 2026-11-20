/**
 * Refetch signals for server-owned boards when a push says the data changed.
 *
 * The gateway enqueues a broadcast notification on a public write (today: `BLOOD_REQUEST_NEW` on
 * `POST /blood-requests`). This module is the seam between the push handler
 * (`services/customerPush.ts`) and the hooks that read those boards
 * (`features/pharma/blood-donor/hooks/useBloodRequests.ts`), so a hook never has to poll to notice
 * another device's write — the push is the trigger, the fetch is still the single source of truth.
 *
 * Deliberately tiny: a `Set` of listeners, no data and no state. If no board is mounted the signal is
 * a no-op (the next mount reads the server anyway).
 */

export type BoardKind = 'blood-requests';

/** Notification kinds the gateway emits for a board-changing write. */
const BOARD_KIND: Partial<Record<string, BoardKind>> = {
  BLOOD_REQUEST_NEW: 'blood-requests',
};

const listeners = new Set<() => void>();

/**
 * Map a notification `kind` (from a push data payload or an inbox row) to the board it invalidates.
 * Returns `undefined` for a kind that does not touch a board, so a call event or order alert is
 * never mistaken for a board refresh.
 */
export function boardForNotificationKind(kind: unknown): BoardKind | undefined {
  return typeof kind === 'string' ? BOARD_KIND[kind] : undefined;
}

/**
 * Tell every mounted board of `kind` that the server data changed. Called from the push handler;
 * safe to call with no listeners (then it is a no-op).
 */
export function refreshBoards(kind: BoardKind): void {
  for (const listener of listeners) listener();
}

/**
 * Subscribe the board hook to refresh signals. Returns the unsubscribe function; the hook passes it
 * straight to `useEffect`, so the listener's lifetime is the hook's lifetime.
 */
export function subscribeBoardRefresh(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
