# Seller notifications

**App / route:** portal `/seller/notifications` (`app/seller/notifications/page.client.tsx`)
**Status:** Shipped
**Trigger:** Seller opens the bell in the console header (`OutletHeader`) or navigates to
`/seller/notifications`.

## Steps

1. The page calls `GET /notifications` (auth-scoped, `notifications.outbox` for the signed-in
   portal user) through `src/lib/api/hooks.ts` → `useNotifications`.
2. Rows are newest-first. An unread row shows the accent dot + soft tint; the header shows the
   unread count.
3. Tapping a row calls `POST /notifications/{id}/read` and deep-links to the described surface.
   The row payload's `data.deepLink` is used when present (internal paths only), otherwise a
   `kind` map links the row (`PRODUCT_APPROVED`/`PRODUCT_REJECTED` → `/seller/products`,
   `SELLER_ORDER_NEW` → `/seller/orders`, `RX_READY` → `/seller/prescriptions`).
4. "Mark all read" calls `POST /notifications/read-all` and is disabled when nothing is unread.

## Product moderation notifications

Admin approve/reject of a listing (`PUT /seller/products/{id}/status`, see
[../catalog/add-product.md](../catalog/add-product.md)) enqueues a `PRODUCT_APPROVED` /
`PRODUCT_REJECTED` outbox row via `contracts.Notifier.EnqueueSeller` from
`server/gateway/internal/catalog/handler.go`. The payload is PII-free: `productId`, `storeId`,
`status`, and a `/seller/products/{id}/edit` deep link, so the seller lands directly on the edit
screen to fix and resubmit a rejected listing. The edit save persists the correction through
`PUT /seller/products/{id}` (see [../catalog/product-trash.md](../catalog/product-trash.md)).

## State

- `useNotifications` local React state; optimistic read marking, reconciled on reload.
- No Zustand store and no fixture rows (the retired `INITIAL` list is gone).

## Data path

- `GET /notifications` → `notifications.outbox` (`user_id` = caller).
- `POST /notifications/{id}/read`, `POST /notifications/read-all` → `notifications.outbox.read_at`.
- Cache: `faazio:v1:notifications:inbox:{userId}` (30 s), invalidated on enqueue.

## Success / error / empty

- **Success:** live rows render; read state persists across reloads.
- **Loading:** skeleton rows while the first fetch is in flight; no fabricated latency.
- **Error:** the list falls back to empty (the gateway is the only source; no fixtures).
- **Empty:** "You're all caught up — no new notifications".

## Known gaps

None for the inbox itself. Push delivery still depends on the outbox drain worker + FCM being
configured (`docs/RUNBOOKS/TROUBLESHOOTING.md`); the in-app inbox works without push.

## Unread badge

The hub-header bell (`OutletHeader` in `src/components/sellers/shells.tsx`) renders an unread badge
from `useUnreadNotifications()` → `GET /notifications/unread-count` (polled every 60 s + on tab
visibility). The count excludes ephemeral `incoming_call` rows.

## Seller onboarding notifications

Approving/rejecting/suspending a seller (`PATCH /sellers/{id}/status` → `ACTIVE`/`REJECTED`/
`SUSPENDED`, `POST /sellers/{id}/verify-kyc`, `POST /sellers/{id}/reject`) enqueues a
`SELLER_APPROVED` / `SELLER_REJECTED` / `SELLER_SUSPENDED` notification to the applicant and the
owner portal logins (`server/gateway/internal/sellers/handler.go` `notifyStatus`). The row deep-links
to `/seller/hub` (approved) or `/seller/outlet-info` (rejected/suspended). The hub also renders the
real `GET /sellers/me` status banner + a checklist derived from live data (no hardcoded "KYC
verified" fixture).

## Admin console

District and super admins have a cross-user console at `/admin/{district,super}/notifications`
(`src/components/admin/AdminNotificationsConsole.tsx`). It has two parts:

- **Seller activity** — `GET /admin/seller-activity` derives recent events straight from the seller
  tables: new registrations (`sellers.sellers`), uploaded KYC documents (`sellers.kyc_documents`) and
  fulfilled document requests (`sellers.document_requests`). Each card opens the seller detail page
  (`/admin/district/sellers/{id}`). This is why seller-registration and document-upload events appear
  here even though they are not customer push-outbox rows (the outbox has no admin recipient).
- **Outbox** — `GET /admin/notifications`, filterable by delivery status (PENDING / SENT / FAILED).
  Rows are clickable: a row carrying `data.sellerId` opens the seller detail, `data.orderId` opens the
  order (super detail / district orders), and `PRODUCT_*` opens the product queue.

The page carries no descriptive copy (titles only).

## Linked docs

- `docs/architecture/web-portal.md`
- `docs/architecture/monolith-breakdown.md` (notifications row)
- `docs/architecture/db-schema.md` §12.12
