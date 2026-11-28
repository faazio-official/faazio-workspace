# Platform-fee change request (seller)

**App / route:** portal `/seller/fee-change-request`, `/seller/fee-history` (also the seller app
WebView, which loads the same portal routes)
**Also reachable from:** `/seller/stores` row link, `/seller/explore` → Account → Platform fee,
desktop sidebar → Account → Platform fee
**Status:** Shipped (submission + own history).
**Trigger:** A seller wants a different platform fee for one of their shops.

## Why the fee is per-vendor

`directory.stores.platform_fee_pct` is a property of the **shop**, not the account
(`0069`/`0072`). A seller who owns a 6% Food kitchen and a 12% Mart electronics shop requests one
without touching the other, and the reviewer decides against the specific shop.

## Steps

1. Page loads the caller's vendors from `GET /seller/stores` (`useSellerScope`) and their own request
   history from `GET /sellers/{id}/platform-fee-requests` (`useSellerFeeChangeRequests`).
2. Seller picks the vendor. The current fee and the app brand come from that store row; the input
   mirrors the store's live fee until the seller types.
3. Seller types a new whole percent. Client-side guards mirror the server's `validPlatformFee`:
   1–100, and **≥ 5 for a FOOD vendor**; the value must differ from the current fee.
4. Seller may add an optional "why" (≤ 500 characters, trimmed). It is stored on the request row as
   `seller_note` (`0106`) — the seller's words, distinct from the admin's `review_reason`.
5. Submit calls `POST /sellers/{id}/platform-fee-request` with only
   `{storeId, platformFeePct, reason}` (the gateway decodes with `DisallowUnknownFields` and resolves
   the current fee + app itself; `reason` may be empty).
6. On success the request is `PENDING`, the history reloads, and the form is re-armed. A second
   pending request for the same store is refused by the gateway (`409 request_pending`, partial
   unique index `seller_fee_requests_one_pending_per_store_idx`).
7. Approval happens out of band on `/admin/district/fee-change-requests` or
   `/admin/super/fee-change-requests`; only `APPROVED` writes `directory.stores.platform_fee_pct`.
   The reviewer sees the seller's reason under the shop name.

## State

- Portal `usePortalStore` session (`sellerId`) + `useSellerScope` (vendors + active store).
- Nothing is cached locally; the history is re-read from the gateway after each submit.

## Data path

- `GET /seller/stores` → `directory.stores`.
- `GET /sellers/{id}/platform-fee-requests` → `sellers.seller_fee_change_requests`
  (RLS/scope: the owning seller, or an admin for the seller's district/state).
- `POST /sellers/{id}/platform-fee-request` → one `PENDING` row (`seller_note` holds the seller's
  optional reason); never mutates the live fee.
- `PATCH /seller/fee-change-requests/{id}/approve|reject` → `APPROVED` copies `requested_fee_pct`
  onto the store; `REJECTED` stores `review_reason`.

## Success / error / empty

- **Success:** toast "Request submitted — an admin will review it"; the row appears as Pending.
- **Error:** the gateway message is surfaced verbatim (e.g. `a fee-change request is already
  pending`, `platform fee is outside the allowed range for this app`, `the shop owner only` for a
  STAFF/VIEWER sub-user).
- **Empty:** no vendors → "Create a shop" path to `/seller/onboarding`; no requests → "No fee change
  requests found" on the history page.
- **Read-only sub-users:** a `VIEWER` credential gets `403 read_only` from the gateway on submit;
  the history read still works.

## Known gaps

- **No cancel.** Status `CANCELLED` exists in the schema, but no endpoint or UI cancels a pending
  request.
- Fee/cover still have no seller editor: `PUT /seller/stores/{id}/fee` is admin-only by design.

## Linked docs

- [`../onboarding/store-setup.md`](../onboarding/store-setup.md) — vendor profile + fee authority
- [`../../../architecture/web-portal.md`](../../../architecture/web-portal.md) — seller/admin routes
- [`../../../architecture/db-schema.md`](../../../architecture/db-schema.md) §12.24 — `0049`/`0072`/`0106`
