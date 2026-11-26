# Customer notifications (in-app inbox + badge)

**App / route:** `Notifications` (`client/mobile/src/features/notifications/NotificationsScreen.tsx`)
**Entry points:** the bell in the **My Account** header (`AccountView.tsx`, wired by `AccountScreen` /
`YouScreen`) and the bell in **My Orders** (`MyOrdersScreen.tsx`); also opened on a push tap.
**Status:** Shipped

## Trigger

- A bell in the My Account header (badge = server unread count) or My Orders header.
- Tapping an order/Rx push notification (`notifications.outbox` row) opens the inbox; if the payload
  carries an `orderId`, the inbox routes to `MyOrders` with that order highlighted.

## Steps

1. On focus, `AccountScreen`/`YouScreen`/`MyOrdersScreen` call
   `useNotificationsStore.refreshUnread()` → `GET /notifications/unread-count` and render the badge.
   The store is shared so every bell shows the same number without each mount downloading the list.
2. Opening `Notifications` calls `GET /notifications` (newest first, `incoming_call` ring rows
   excluded) and syncs the store unread count.
3. Tapping a row marks it read (`POST /notifications/{id}/read`) and, when the row payload has an
   `orderId`, navigates to `MyOrders` with `highlightOrderId`.
4. "Mark all read" (`POST /notifications/read-all`) optimistically clears the list and sets the
   shared badge to 0.

## State

- `src/state/notificationsStore.ts` — the shared unread count (`unread`, `refreshUnread`,
  `setUnread`, `reset`). Reset on sign-out (`services/logout.ts`).
- Screen-local list state in `NotificationsScreen.tsx`; no persisted fixture rows.

## Data path

- `GET /notifications` → `notifications.outbox` (`user_id` = caller, `kind <> 'incoming_call'`).
- `GET /notifications/unread-count` → `count(*) where read_at is null and kind <> 'incoming_call'`.
- `POST /notifications/{id}/read`, `POST /notifications/read-all` → `notifications.outbox.read_at`.
- Cache: `faazio:v1:notifications:inbox:{userId}` + `faazio:v1:notifications:unread:{userId}` (30 s),
  both invalidated on enqueue and on read.
- Push: `services/customerPush.ts` refreshes the badge for any push and opens `Notifications` on a
  non-call tap; the device token is registered through `POST /notifications/register`.

## Success / error / empty

- **Success:** live rows render with unread dot + tint; read state persists.
- **Loading:** "Loading notifications..." while the first fetch is in flight; no fabricated latency.
- **Error:** "Notifications unavailable" with a Retry action (the gateway is the only source).
- **Empty:** "No notifications yet" (or the error state when the fetch failed).

## Kinds that appear

`ORDER_PACKED`/`ORDER_SHIPPED`/`ORDER_DELIVERED`/`ORDER_CANCELLED`/`ORDER_RETURNED`/
`ORDER_REJECTED`, `RX_READY`, `DELIVERY_OTP`, `ORDER_DELIVERED` (from rider completion). Seller
onboarding (`SELLER_APPROVED`/`SELLER_REJECTED`) and `incoming_call` do **not** appear here (the
latter is the call surface).

## Known gaps

- No pagination: the inbox serves the newest 50 (server max 200); older rows are unreachable.
- No delete/dismiss and no customer notification preferences yet.

## Linked docs

- [profile/index.md](./index.md)
- `docs/architecture/monolith-breakdown.md` (notifications row)
- `server/gateway/internal/notifications/`
