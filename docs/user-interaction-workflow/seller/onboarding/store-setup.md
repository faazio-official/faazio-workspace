# Store / vendor setup

**App / route:** portal `/seller/stores`, `/seller/onboarding`, `/seller/outlet-info`
**Status:** Partial (platform fee and cover-image steps have no seller UI)
**Trigger:** Seller completes onboarding or opens the stores page.

## Steps

1. `GET /seller/stores` lists the caller's vendors (the portal switcher's data source).
2. Seller creates a vendor with `POST /seller/stores` (name, app, address, phone, hours, live flag;
   FSSAI/drug licence where applicable). The portal form does not send a platform fee.
3. Seller edits the profile with `PUT /seller/stores/{id}`. Platform fee is **not** seller-editable:
   `PUT /seller/stores/{id}/fee` is admin-only (`403 forbidden`) and a seller-supplied fee is
   zeroed. Sellers file `POST /sellers/{id}/platform-fee-request` instead.
4. Seller toggles live/offline with `PUT /seller/stores/{id}/live`. `PUT /seller/stores/{id}/cover`
   exists on the gateway but no client calls it yet.
5. A vendor is a `directory.stores` row with a NOT NULL `seller_id`; products/menus derive ownership
   through the store.

## State

- Portal `usePortalStore` / seller scope.
- No mobile store; the seller app is a WebView.

## Data path

- `GET /seller/stores`, `POST /seller/stores`, `PUT /seller/stores/{id}` →
  `directory.stores`.
- `PUT /seller/stores/{id}/fee` → admin-only, per-vendor `platform_fee_pct`.
- `POST /sellers/{id}/platform-fee-request` → seller fee-change request.
- `PUT /seller/stores/{id}/live` → `directory.stores.is_live`; purges the store's geo/catalog cache
  keys.
- `PUT /seller/stores/{id}/cover` + media confirm → `media.assets` (gateway-only today).

## Success / error / empty

- **Success:** vendor created/edited/live.
- **Error:** portal error; no fake store.
- **Empty:** no vendors → create-vendor empty state.

## Known gaps

- Platform fee is admin-controlled; the seller only files a fee-change request.
- Cover-image upload has no seller UI even though the endpoint exists.
- The create-vendor form does not collect a platform fee.

## Linked docs

- `docs/architecture/monolith-breakdown.md` (directory/sellers rows)
- `docs/architecture/db-schema.md` (`directory.stores`)
- `docs/architecture/caching-cloudflare-valkey.md` (store live purge)
