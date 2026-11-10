# Seller creates, links and reviews add-ons

**App / route(s):** seller web portal · `/seller/inventory` (Add-ons tab), admin `/admin/district/addons/queue`
**Status:** Shipped
**Trigger:** Seller taps **Create** in the Add-ons tab, or **Add add-on** on a dish; admin opens the Add-on queue.

## Steps

1. Seller opens **Inventory → Add-ons**. The page loads the venue's add-ons (`GET /seller/addons?venueId=`)
   and every dish link (`GET /seller/menu-addons?venueId=`).
2. **Create add-on** → a sheet collects name, optional group, price (₹) and veg flag. Saving calls
   `createAddon` (`POST /seller/addons`) and the new row opens as **DRAFT**. The seller sees it in
   "Your add-ons" and can edit it later.
3. **Link to a dish** → **Add add-on** on a dish opens a multi-select sheet. Saving diffs the
   selection and calls `linkAddonToDish` (`POST /seller/menu-addons`) / `unlinkAddonFromDish`
   (`DELETE /seller/menu-addons/{venueId}/{dishId}/{addonId}`). The on/off toggle on a linked row
   disables/enables that link only; it never changes the add-on's own status.
4. **Submit for review** (visible on DRAFT/DELISTED rows) calls `submitAddonForReview`
   (`POST /seller/addons/{addonId}/submit-for-review`) → **PENDING_REVIEW**. The seller is told admin
   approval is required before customers see it.
5. Admin opens **Add-on queue** (`/admin/district/addons/queue`), which lists PENDING_REVIEW add-ons
   in district scope (`GET /seller/addons?status=PENDING_REVIEW`).
   - **Approve** → `POST /seller/addons/{addonId}/approve` → **ACTIVE**; the add-on becomes orderable
     on every enabled dish link. The seller is notified (`ADDON_APPROVED`).
   - **Reject** (reason required) → `POST /seller/addons/{addonId}/reject` → **DRAFT** +
     `review_reason`; the seller sees the note on the add-on and is notified (`ADDON_REJECTED`).
6. **Delist** calls `DELETE /seller/addons/{addonId}` → **DELISTED**. Customers stop seeing it;
   the seller can resubmit later.

## State

- Page-local React state in `app/seller/inventory/page.client.tsx` holds `addons`, `links`, loading
  and the sheet selections. No client-side catalogue copy: every row comes from the gateway.
- Admin queue page holds the pending list in page-local state and refetches after each decision.

## Data path

- `listAddons` → `GET /seller/addons` → `directory.addons` (seller/district scope via
  `directory.stores.seller_id` + `sellers.sellers.district_code`).
- `createAddon` → `POST /seller/addons` → `directory.addons` (DRAFT, price stored as paisa).
- `updateAddon` → `PUT /seller/addons/{addonId}`.
- `submitAddonForReview` → `POST /seller/addons/{addonId}/submit-for-review` → `PENDING_REVIEW`.
- `approveAddon` / `rejectAddon` → `POST /seller/addons/{addonId}/approve|reject` (admin only) →
  `ACTIVE` / `DRAFT` + `review_reason`.
- `delistAddon` → `DELETE /seller/addons/{addonId}` → `DELISTED`.
- `listMenuAddons` → `GET /seller/menu-addons` → `directory.menu_addon_links` joined to
  `directory.addons`.
- `linkAddonToDish` → `POST /seller/menu-addons`; `unlinkAddonFromDish` →
  `DELETE /seller/menu-addons/{venueId}/{dishId}/{addonId}`.
- Public customer read: `GET /venues/{venueId}/menu/{dishId}/addons` returns **ACTIVE** +
  enabled links only.

## Success / error / empty

- **Success:** the new/updated row reflects the server response; toast confirms the action.
- **Error:** `ApiError` surfaces a toast; the list is refetched from the server (no optimistic
  ghost rows). Ownership/scope failures are `404 not_found` so ids cannot be probed.
- **Empty:** "No add-ons linked yet" per dish, an empty "Your add-ons" section, and an honest admin
  queue empty state. No fixtures.

## Known gaps

- Admin notification on submit-for-review is the queue itself + audit log; there is no separate
  email/push to admins yet.
- Editing an ACTIVE add-on keeps it ACTIVE (same behaviour as menu/product edits); only the
  submit→approve lifecycle gates a new add-on.

## Linked docs

- `docs/architecture/db-schema.md` §12.37
- `docs/architecture/server-gateway-plan.md`
- `docs/architecture/monolith-breakdown.md` §1
- `docs/user-interaction-workflow/customer/cart-checkout/add-to-cart.md`
